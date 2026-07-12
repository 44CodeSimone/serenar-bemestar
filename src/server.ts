import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type ExecutionCtx = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// ---------------- Edge cache ----------------
//
// We cache public HTML at the Cloudflare edge using the Workers Cache API.
// Setting response headers alone is NOT enough for HTML — Cloudflare's default
// Cache Everything policy does not include text/html. We must explicitly do
// cache.match() before rendering, and cache.put() after.

// Paths whose HTML is user-specific and MUST NOT be cached at the edge.
const PRIVATE_PATH_PREFIXES = ["/admin", "/auth", "/perfil", "/api"];

// Cookies that indicate an application session. If any of these are present on
// the request we bypass the public cache entirely — Vary: Cookie alone is not a
// safe boundary since every unique Cookie header creates a separate cache key.
// Match Supabase auth cookies (sb-*-auth-token[.n]) and common session names.
const APP_SESSION_COOKIE_PATTERNS: RegExp[] = [
  /(^|;\s*)sb-[^=]*-auth-token(\.[0-9]+)?=/i,
  /(^|;\s*)(session|sid|auth|token|access_token|refresh_token)=/i,
];

// Cookies Cloudflare itself sets that must NOT fragment or disable the cache.
const CLOUDFLARE_TECHNICAL_COOKIE_NAMES = new Set([
  "__cf_bm",
  "__cflb",
  "__cfruid",
  "cf_clearance",
  "cf_chl_2",
  "cf_chl_prog",
]);

const EDGE_TTL_SECONDS = 300;

function hasAppSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  return APP_SESSION_COOKIE_PATTERNS.some((re) => re.test(cookieHeader));
}

function isCacheableRequest(request: Request): boolean {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.search && url.search !== "") return false;
  if (PRIVATE_PATH_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`))) {
    return false;
  }
  if (hasAppSessionCookie(request.headers.get("cookie"))) return false;
  return true;
}

function isCacheableResponse(response: Response): boolean {
  if (response.status !== 200) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return false;
  const cc = response.headers.get("cache-control") ?? "";
  if (/no-store|private/i.test(cc)) return false;
  // If the origin explicitly set a Set-Cookie, don't cache — response is per-user.
  if (response.headers.get("set-cookie")) return false;
  return true;
}

// Build a stable cache key that ignores Cloudflare technical cookies (which
// change per-visitor and would otherwise fragment the cache into single-hit
// entries) while still keying on the URL. We drop the Cookie header entirely
// for the cache key — we've already refused to cache anything with a real app
// session cookie above, so any remaining cookies are noise (cf_* etc).
function buildCacheKey(request: Request): Request {
  const url = new URL(request.url);
  // Normalize: strip any residual query and force https for the key.
  url.search = "";
  const headers = new Headers(request.headers);
  headers.delete("cookie");
  return new Request(url.toString(), {
    method: "GET",
    headers,
  });
}

function stripTechnicalCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const kept = cookieHeader
    .split(/;\s*/)
    .filter((pair) => {
      const eq = pair.indexOf("=");
      const name = (eq === -1 ? pair : pair.slice(0, eq)).trim();
      return name && !CLOUDFLARE_TECHNICAL_COOKIE_NAMES.has(name);
    })
    .join("; ");
  return kept.length ? kept : null;
}

function prepareResponseForCache(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "cache-control",
    `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=86400`,
  );
  // Accept-Encoding is fine; we intentionally do NOT include Cookie in Vary
  // (we've already excluded session-bearing requests from caching, and
  // Vary: Cookie would over-fragment the cache due to cf_* cookies).
  headers.set("vary", "Accept-Encoding");
  headers.set("x-edge-cache", "STORED");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function tagCacheHit(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("x-edge-cache", "HIT");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function tagCacheMiss(response: Response): Response {
  const headers = new Headers(response.headers);
  if (!headers.has("x-edge-cache")) headers.set("x-edge-cache", "MISS");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// caches.default may be undefined in dev/non-Workers runtimes. Guard access.
function getEdgeCache(): Cache | null {
  try {
    // @ts-expect-error — caches is a Workers global not in Node lib types.
    const c = typeof caches !== "undefined" ? caches.default : null;
    return (c as Cache) ?? null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const edgeCache = getEdgeCache();
      const cacheable = isCacheableRequest(request);

      // Build a request with technical Cloudflare cookies stripped so the
      // downstream SSR handler sees a clean cookie header and cache-key
      // fragmentation is minimized.
      const cleanCookies = stripTechnicalCookies(request.headers.get("cookie"));
      const forwardHeaders = new Headers(request.headers);
      if (cleanCookies) forwardHeaders.set("cookie", cleanCookies);
      else forwardHeaders.delete("cookie");
      const forwardRequest = new Request(request.url, {
        method: request.method,
        headers: forwardHeaders,
        body:
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : request.body,
      });

      // 1) Try edge cache first for eligible public requests.
      if (cacheable && edgeCache) {
        const cacheKey = buildCacheKey(request);
        const hit = await edgeCache.match(cacheKey);
        if (hit) return tagCacheHit(hit);
      }

      // 2) Miss — run the SSR handler.
      const handler = await getServerEntry();
      const raw = await handler.fetch(forwardRequest, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(raw);

      // 3) Store eligible responses using waitUntil so the write doesn't block.
      if (cacheable && edgeCache && isCacheableResponse(normalized)) {
        const cacheKey = buildCacheKey(request);
        const forCache = prepareResponseForCache(normalized.clone());
        const execCtx = ctx as ExecutionCtx | undefined;
        const put = edgeCache.put(cacheKey, forCache);
        if (execCtx?.waitUntil) execCtx.waitUntil(put);
        else await put.catch((e) => console.error("edge cache put failed", e));

        // Return a response with the same headers we stored but tagged MISS.
        const missHeaders = new Headers(normalized.headers);
        missHeaders.set(
          "cache-control",
          `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=86400`,
        );
        missHeaders.set("vary", "Accept-Encoding");
        missHeaders.set("x-edge-cache", "MISS");
        return new Response(normalized.body, {
          status: normalized.status,
          statusText: normalized.statusText,
          headers: missHeaders,
        });
      }

      return cacheable ? tagCacheMiss(normalized) : normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

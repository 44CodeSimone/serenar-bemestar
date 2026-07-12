import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
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

// ---------------- Edge cache hints ----------------
// We only set Cache-Control headers here. Direct use of the Workers Cache API
// (caches.default.match/put) was reverted because it caused hard 500s in
// production — put() throws when a response has Set-Cookie or when the runtime
// context does not expose a real Cache binding, and any throw in this fetch
// handler surfaces to visitors as a bare 500. Cache-Control alone is safe.

const PRIVATE_PATH_PREFIXES = ["/admin", "/auth", "/perfil", "/api"];
const APP_SESSION_COOKIE_PATTERNS: RegExp[] = [
  /(^|;\s*)sb-[^=]*-auth-token(\.[0-9]+)?=/i,
  /(^|;\s*)(session|sid|auth|token|access_token|refresh_token)=/i,
];
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
  if (response.headers.get("set-cookie")) return false;
  return true;
}

function withCacheHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set(
    "cache-control",
    `public, max-age=0, s-maxage=${EDGE_TTL_SECONDS}, stale-while-revalidate=86400`,
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const raw = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(raw);

      if (isCacheableRequest(request) && isCacheableResponse(normalized)) {
        return withCacheHeaders(normalized);
      }
      return normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

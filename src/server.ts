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

// Paths whose HTML is user-specific and MUST NOT be cached at the edge.
const PRIVATE_PATH_PREFIXES = ["/admin", "/auth", "/perfil", "/api"];

function isPublicHtmlGet(request: Request, response: Response): boolean {
  if (request.method !== "GET") return false;
  if (response.status !== 200) return false;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) return false;
  const { pathname, search } = new URL(request.url);
  if (search && search !== "") return false; // don't cache query-string variants
  if (PRIVATE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  // Skip if the app already opted this response out of caching.
  const existing = response.headers.get("cache-control") ?? "";
  if (/no-store|private/i.test(existing)) return false;
  return true;
}

function withEdgeCacheHeaders(request: Request, response: Response): Response {
  if (!isPublicHtmlGet(request, response)) return response;
  const headers = new Headers(response.headers);
  // Browsers revalidate quickly; Cloudflare edge caches for 5 minutes and
  // serves stale-while-revalidate for a day, cutting TTFB on repeat traffic
  // to tens of milliseconds while keeping content fresh.
  headers.set(
    "cache-control",
    "public, max-age=0, must-revalidate, s-maxage=300, stale-while-revalidate=86400",
  );
  headers.set("vary", "Accept-Encoding, Cookie");
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
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return withEdgeCacheHeaders(request, normalized);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

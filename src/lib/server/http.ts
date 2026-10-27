/** Route-handler plumbing: typed errors, JSON responses, body parsing and the error boundary. */
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type z, type ZodTypeAny } from "zod";
import type { ApiError } from "@/lib/contracts";

export type ErrorCode =
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "payload_too_large"
  | "internal";

const STATUS: Record<ErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  payload_too_large: 413,
  rate_limited: 429,
  internal: 500,
};

export class HttpError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const notFound = (what = "Resource") => new HttpError("not_found", `${what} not found`);

export function json<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

export function errorResponse(err: HttpError): NextResponse<ApiError> {
  const body: ApiError = { error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } };
  return NextResponse.json(body, { status: STATUS[err.code], headers: { "Cache-Control": "no-store", ...err.headers } });
}

/** Parses and validates a JSON body. Empty bodies validate as `{}` so defaults apply. */
export async function parseJson<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  const text = await req.text();
  if (text.length > 100_000) throw new HttpError("payload_too_large", "Request body is too large");
  let raw: unknown = {};
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw new HttpError("validation_error", "Request body must be valid JSON");
    }
  }
  return schema.parse(raw);
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * CSRF defence in depth (cookies are also SameSite=Lax): browsers always send
 * Origin on cross-site mutations, so a foreign Origin is rejected.
 */
export function assertSameOrigin(req: NextRequest): void {
  if (!MUTATING.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server)
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new HttpError("forbidden", "Invalid Origin header");
  }
  const allowed = new Set(
    [req.headers.get("x-forwarded-host"), req.headers.get("host"), ...(process.env.ALLOWED_ORIGINS ?? "").split(",")]
      .filter(Boolean)
      .map((h) => h!.trim().replace(/^https?:\/\//, "")),
  );
  if (!allowed.has(originHost)) throw new HttpError("forbidden", "Cross-origin request blocked");
}

/** Next passes dynamic segments as a promise; its generated route types expect `Promise<unknown>`. */
type RouteContext = { params: Promise<unknown> };

/** Wraps a route handler with origin checks and a uniform error boundary. */
export function route<P = Record<string, never>>(
  fn: (req: NextRequest, params: P) => Promise<Response>,
): (req: NextRequest, ctx: RouteContext) => Promise<Response> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      const params = (ctx?.params ? await ctx.params : {}) as P;
      return await fn(req, params);
    } catch (err) {
      if (err instanceof HttpError) return errorResponse(err);
      if (err instanceof ZodError) {
        return errorResponse(
          new HttpError(
            "validation_error",
            err.issues[0]?.message ?? "Invalid request",
            err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          ),
        );
      }
      console.error("[api] unhandled error", req.method, req.nextUrl.pathname, err);
      return errorResponse(new HttpError("internal", "Something went wrong. Please try again."));
    }
  };
}

/** True when a database error is a unique-constraint violation (Postgres 23505). */
export function isUniqueViolation(err: unknown): boolean {
  const seen = new Set<unknown>();
  let e: unknown = err;
  while (e && typeof e === "object" && !seen.has(e)) {
    seen.add(e);
    if ((e as { code?: unknown }).code === "23505") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

/**
 * Client IP for rate limiting, read only from headers a trusted proxy controls:
 * - on Vercel, `x-real-ip` (set by the platform, cannot be spoofed);
 * - elsewhere, the X-Forwarded-For entry added by our own proxy: TRUSTED_PROXY_HOPS
 *   (default 1) counts from the right, so values a client prepends are ignored.
 * Set TRUSTED_PROXY_HOPS=0 when the app is exposed directly (no proxy).
 */
export function clientIp(req: NextRequest): string {
  if (process.env.VERCEL) return req.headers.get("x-real-ip") ?? "unknown";
  const hops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1);
  if (!Number.isInteger(hops) || hops <= 0) return "direct";
  const chain = (req.headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain[chain.length - hops] ?? chain[0] ?? "unknown";
}

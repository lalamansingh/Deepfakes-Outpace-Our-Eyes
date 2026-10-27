/**
 * Fixed-window rate limiter kept in process memory. Good for a single instance;
 * behind several instances, swap the store for Redis with the same interface.
 */
import { HttpError } from "./http";

type Window = { count: number; resetAt: number };

const store = new Map<string, Window>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, w] of store) if (w.resetAt <= now) store.delete(key);
}

/** Counts one hit for `key` in its window and returns the window. */
export function recordHit(key: string, windowMs: number, now = Date.now()): Window {
  sweep(now);
  const w = store.get(key);
  if (!w || w.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    store.set(key, fresh);
    return fresh;
  }
  w.count++;
  return w;
}

/** Throws `rate_limited` (429 with Retry-After) once `key` exceeds `limit` hits per `windowMs`. */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  const w = recordHit(key, windowMs, now);
  if (w.count > limit) {
    const retry = Math.ceil((w.resetAt - now) / 1000);
    throw new HttpError("rate_limited", "Too many requests. Please slow down.", undefined, { "Retry-After": String(retry) });
  }
}

/** True when `key` has already used up `limit` hits in its current window (does not count a hit). */
export function isRateLimited(key: string, limit: number, now = Date.now()): boolean {
  const w = store.get(key);
  return Boolean(w && w.resetAt > now && w.count >= limit);
}

export function resetRateLimits(): void {
  store.clear();
}

// Per-IP limits are generous: a whole school often shares one public IP.
export const LIMITS = {
  session: [600, 60_000], // per IP
  rounds: [30, 60_000], // per player
  answers: [120, 60_000], // per player
  join: [10, 600_000], // per player
  joinFailures: [40, 600_000], // wrong join codes per IP (stops code guessing)
  login: [10, 600_000], // per IP + email; per IP is 3x this
  register: [20, 3_600_000], // per IP
  staffWrite: [120, 60_000],
  upload: [30, 600_000],
} as const satisfies Record<string, readonly [number, number]>;

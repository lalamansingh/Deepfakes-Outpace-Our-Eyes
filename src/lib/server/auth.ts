/**
 * Sessions are signed JWTs (HS256) in httpOnly cookies:
 * - rr_player: anonymous player id (1 year), created on first visit
 * - rr_staff: teacher/admin id + role (7 days), created at login
 * The role inside the token is never trusted alone: staff are re-read from the DB.
 */
import { jwtVerify, SignJWT } from "jose";
import { eq } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { StaffRole } from "@/lib/contracts";
import { getDb, schema } from "@/db/client";
import { HttpError } from "./http";

export const PLAYER_COOKIE = "rr_player";
export const STAFF_COOKIE = "rr_staff";
const PLAYER_TTL_S = 60 * 60 * 24 * 365;
const STAFF_TTL_S = 60 * 60 * 24 * 7;
const ISSUER = "real-or-rendered";

let warned = false;
function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set to at least 32 characters in production");
  }
  if (!warned) {
    warned = true;
    console.warn("[auth] SESSION_SECRET not set; using an insecure development secret");
  }
  return new TextEncoder().encode("dev-only-insecure-secret-change-me-0123456789");
}

async function sign(payload: Record<string, unknown>, subject: string, ttl: number, audience: string) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setIssuer(ISSUER)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(secret());
}

async function verify(token: string | undefined, audience: string) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience, algorithms: ["HS256"] });
    return payload;
  } catch {
    return null;
  }
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

// ---------------------------------------------------------------- players

export async function readPlayerId(req: NextRequest): Promise<string | null> {
  const payload = await verify(req.cookies.get(PLAYER_COOKIE)?.value, "player");
  return typeof payload?.sub === "string" ? payload.sub : null;
}

export async function setPlayerCookie(res: NextResponse, playerId: string): Promise<void> {
  res.cookies.set(PLAYER_COOKIE, await sign({}, playerId, PLAYER_TTL_S, "player"), cookieOptions(PLAYER_TTL_S));
}

/** The current player's id; 401 when the visitor has no valid session yet. */
export async function requirePlayerId(req: NextRequest): Promise<string> {
  const id = await readPlayerId(req);
  if (!id) throw new HttpError("unauthorized", "Start a session first");
  return id;
}

// ---------------------------------------------------------------- staff

export type StaffSession = { id: string; email: string; name: string; role: StaffRole };

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

let dummy: Promise<string> | undefined;
/** A real bcrypt hash, compared against for unknown emails so login timing doesn't reveal which accounts exist. */
export function dummyHash(): Promise<string> {
  dummy ??= bcrypt.hash("timing-equaliser", 12);
  return dummy;
}

export async function setStaffCookie(res: NextResponse, user: { id: string; role: StaffRole }): Promise<void> {
  res.cookies.set(STAFF_COOKIE, await sign({ role: user.role }, user.id, STAFF_TTL_S, "staff"), cookieOptions(STAFF_TTL_S));
}

export function clearStaffCookie(res: NextResponse): void {
  res.cookies.set(STAFF_COOKIE, "", { ...cookieOptions(0), maxAge: 0 });
}

export async function readStaff(req: NextRequest): Promise<StaffSession | null> {
  const payload = await verify(req.cookies.get(STAFF_COOKIE)?.value, "staff");
  if (typeof payload?.sub !== "string") return null;
  const db = await getDb();
  const [user] = await db
    .select({ id: schema.staffUsers.id, email: schema.staffUsers.email, name: schema.staffUsers.name, role: schema.staffUsers.role })
    .from(schema.staffUsers)
    .where(eq(schema.staffUsers.id, payload.sub))
    .limit(1);
  return user ?? null;
}

/** Requires a signed-in staff member with one of `roles`. Admins pass every staff check. */
export async function requireStaff(req: NextRequest, roles: readonly StaffRole[] = ["teacher", "admin"]): Promise<StaffSession> {
  const user = await readStaff(req);
  if (!user) throw new HttpError("unauthorized", "Please sign in");
  if (user.role !== "admin" && !roles.includes(user.role)) throw new HttpError("forbidden", "You do not have access to this");
  return user;
}

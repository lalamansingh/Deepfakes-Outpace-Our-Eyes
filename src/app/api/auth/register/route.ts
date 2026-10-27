import { getDb, schema } from "@/db/client";
import { registerSchema, type StaffDTO } from "@/lib/contracts";
import { hashPassword, setStaffCookie } from "@/lib/server/auth";
import { clientIp, HttpError, isUniqueViolation, json, parseJson, route } from "@/lib/server/http";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";

/** Teacher sign-up. Set TEACHER_SIGNUP=closed to disable it (admins can still be seeded). */
export const POST = route(async (req) => {
  if (process.env.TEACHER_SIGNUP === "closed") throw new HttpError("forbidden", "Sign-up is closed. Ask an administrator for an account.");
  rateLimit(`register:${clientIp(req)}`, ...LIMITS.register);
  const input = await parseJson(req, registerSchema);
  const db = await getDb();
  try {
    const [user] = await db
      .insert(schema.staffUsers)
      .values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password), role: "teacher" })
      .returning();
    const body: StaffDTO = { id: user.id, email: user.email, name: user.name, role: user.role };
    const res = json(body, { status: 201 });
    await setStaffCookie(res, user);
    return res;
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError("conflict", "An account with this email already exists");
    throw err;
  }
});

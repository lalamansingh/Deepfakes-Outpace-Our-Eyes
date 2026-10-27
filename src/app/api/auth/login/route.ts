import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { loginSchema, type StaffDTO } from "@/lib/contracts";
import { dummyHash, setStaffCookie, verifyPassword } from "@/lib/server/auth";
import { clientIp, HttpError, json, parseJson, route } from "@/lib/server/http";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";

export const POST = route(async (req) => {
  const ip = clientIp(req);
  const { email, password } = await parseJson(req, loginSchema);
  rateLimit(`login:${ip}`, LIMITS.login[0] * 3, LIMITS.login[1]);
  rateLimit(`login:${ip}:${email}`, ...LIMITS.login);
  const db = await getDb();
  const [user] = await db.select().from(schema.staffUsers).where(eq(schema.staffUsers.email, email)).limit(1);
  // Always run bcrypt so response time does not reveal whether the email exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) throw new HttpError("unauthorized", "Email or password is incorrect");
  const body: StaffDTO = { id: user.id, email: user.email, name: user.name, role: user.role };
  const res = json(body);
  await setStaffCookie(res, user);
  return res;
});

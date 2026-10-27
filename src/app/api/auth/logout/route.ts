import { clearStaffCookie } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

export const POST = route(async () => {
  const res = json({ ok: true });
  clearStaffCookie(res);
  return res;
});

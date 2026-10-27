import type { StaffDTO } from "@/lib/contracts";
import { requireStaff } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

export const GET = route(async (req) => {
  const user: StaffDTO = await requireStaff(req);
  return json(user);
});

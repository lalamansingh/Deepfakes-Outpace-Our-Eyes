import { getDb } from "@/db/client";
import { requireStaff } from "@/lib/server/auth";
import { classDashboard } from "@/lib/server/classrooms";
import { json, route } from "@/lib/server/http";
import { idParam } from "@/lib/server/params";

export const GET = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff(req);
  return json(await classDashboard(await getDb(), idParam(id, "Class"), staff));
});

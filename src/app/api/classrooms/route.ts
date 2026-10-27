import { getDb } from "@/db/client";
import { createClassroomSchema } from "@/lib/contracts";
import { requireStaff } from "@/lib/server/auth";
import { createClassroom, listClassrooms } from "@/lib/server/classrooms";
import { json, parseJson, route } from "@/lib/server/http";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";

export const GET = route(async (req) => {
  const staff = await requireStaff(req);
  return json({ classrooms: await listClassrooms(await getDb(), staff.id) });
});

export const POST = route(async (req) => {
  const staff = await requireStaff(req);
  rateLimit(`staff:${staff.id}`, ...LIMITS.staffWrite);
  const { name } = await parseJson(req, createClassroomSchema);
  return json(await createClassroom(await getDb(), staff.id, name), { status: 201 });
});

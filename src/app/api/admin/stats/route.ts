import { getDb } from "@/db/client";
import { requireStaff } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { adminStats } from "@/lib/server/items";

export const GET = route(async (req) => {
  await requireStaff(req, ["admin"]);
  return json(await adminStats(await getDb()));
});

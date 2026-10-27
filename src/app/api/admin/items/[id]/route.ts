import { getDb } from "@/db/client";
import { itemPatchSchema } from "@/lib/contracts";
import { requireStaff } from "@/lib/server/auth";
import { json, parseJson, route } from "@/lib/server/http";
import { archiveItem, getItem, updateItem } from "@/lib/server/items";
import { idParam } from "@/lib/server/params";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";

export const GET = route<{ id: string }>(async (req, { id }) => {
  await requireStaff(req, ["admin"]);
  return json(await getItem(await getDb(), idParam(id, "Item")));
});

export const PATCH = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff(req, ["admin"]);
  rateLimit(`staff:${staff.id}`, ...LIMITS.staffWrite);
  const patch = await parseJson(req, itemPatchSchema);
  return json(await updateItem(await getDb(), idParam(id, "Item"), patch));
});

export const DELETE = route<{ id: string }>(async (req, { id }) => {
  const staff = await requireStaff(req, ["admin"]);
  rateLimit(`staff:${staff.id}`, ...LIMITS.staffWrite);
  await archiveItem(await getDb(), idParam(id, "Item"));
  return json({ ok: true });
});

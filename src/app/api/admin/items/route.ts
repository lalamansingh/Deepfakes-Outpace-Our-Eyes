import { z } from "zod";
import { getDb } from "@/db/client";
import { ITEM_STATUSES, itemInputSchema, LABELS, REVIEW_STATUSES } from "@/lib/contracts";
import { requireStaff } from "@/lib/server/auth";
import { json, parseJson, route } from "@/lib/server/http";
import { createItem, listItems } from "@/lib/server/items";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";

const filtersSchema = z.object({
  status: z.enum(ITEM_STATUSES).optional(),
  label: z.enum(LABELS).optional(),
  review: z.enum(REVIEW_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});

export const GET = route(async (req) => {
  await requireStaff(req, ["admin"]);
  const params = Object.fromEntries([...req.nextUrl.searchParams.entries()].filter(([, v]) => v !== ""));
  const filters = filtersSchema.parse(params);
  return json({ items: await listItems(await getDb(), filters) });
});

export const POST = route(async (req) => {
  const staff = await requireStaff(req, ["admin"]);
  rateLimit(`staff:${staff.id}`, ...LIMITS.staffWrite);
  const input = await parseJson(req, itemInputSchema);
  return json(await createItem(await getDb(), input), { status: 201 });
});

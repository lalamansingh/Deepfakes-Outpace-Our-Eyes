import { getDb } from "@/db/client";
import { json, route } from "@/lib/server/http";
import { credits } from "@/lib/server/items";

export const GET = route(async () => {
  return json({ credits: await credits(await getDb()) }, { headers: { "Cache-Control": "public, max-age=300" } });
});

import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { json, route } from "@/lib/server/http";

/** Liveness + database check for load balancers and uptime monitors. */
export const GET = route(async () => {
  const db = await getDb();
  await db.execute(sql`select 1`);
  return json({ ok: true, time: new Date().toISOString() });
});

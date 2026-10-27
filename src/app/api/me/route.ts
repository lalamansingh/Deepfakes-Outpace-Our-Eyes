import { getDb } from "@/db/client";
import { requirePlayerId } from "@/lib/server/auth";
import { HttpError, json, route } from "@/lib/server/http";
import { getPlayerDTO, playerExists } from "@/lib/server/players";

export const GET = route(async (req) => {
  const id = await requirePlayerId(req);
  const db = await getDb();
  if (!(await playerExists(db, id))) throw new HttpError("unauthorized", "Start a session first");
  return json(await getPlayerDTO(db, id));
});

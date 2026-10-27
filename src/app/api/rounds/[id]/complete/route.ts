import { getDb } from "@/db/client";
import { requirePlayerId } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";
import { idParam } from "@/lib/server/params";
import { completeRound } from "@/lib/server/rounds";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const playerId = await requirePlayerId(req);
  return json(await completeRound(await getDb(), playerId, idParam(id, "Round")));
});

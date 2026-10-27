import { getDb } from "@/db/client";
import { createRoundSchema } from "@/lib/contracts";
import { requirePlayerId } from "@/lib/server/auth";
import { json, parseJson, route } from "@/lib/server/http";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { createRound } from "@/lib/server/rounds";

export const POST = route(async (req) => {
  const playerId = await requirePlayerId(req);
  rateLimit(`rounds:${playerId}`, ...LIMITS.rounds);
  const { kind } = await parseJson(req, createRoundSchema);
  return json(await createRound(await getDb(), playerId, kind));
});

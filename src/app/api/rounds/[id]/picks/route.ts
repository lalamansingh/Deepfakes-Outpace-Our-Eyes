import { getDb } from "@/db/client";
import { spotPickSchema } from "@/lib/contracts";
import { requirePlayerId } from "@/lib/server/auth";
import { json, parseJson, route } from "@/lib/server/http";
import { idParam } from "@/lib/server/params";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { answerSpot } from "@/lib/server/rounds";

/** Spot rounds: pick the odd one out of a puzzle. */
export const POST = route<{ id: string }>(async (req, { id }) => {
  const playerId = await requirePlayerId(req);
  rateLimit(`answers:${playerId}`, ...LIMITS.answers);
  const input = await parseJson(req, spotPickSchema);
  return json(await answerSpot(await getDb(), playerId, idParam(id, "Round"), input));
});

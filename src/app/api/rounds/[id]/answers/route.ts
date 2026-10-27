import { getDb } from "@/db/client";
import { answerSchema } from "@/lib/contracts";
import { requirePlayerId } from "@/lib/server/auth";
import { json, parseJson, route } from "@/lib/server/http";
import { idParam } from "@/lib/server/params";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";
import { answerItem } from "@/lib/server/rounds";

export const POST = route<{ id: string }>(async (req, { id }) => {
  const playerId = await requirePlayerId(req);
  rateLimit(`answers:${playerId}`, ...LIMITS.answers);
  const input = await parseJson(req, answerSchema);
  return json(await answerItem(await getDb(), playerId, idParam(id, "Round"), input));
});

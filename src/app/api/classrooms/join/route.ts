import { getDb } from "@/db/client";
import { joinClassroomSchema } from "@/lib/contracts";
import { requirePlayerId } from "@/lib/server/auth";
import { joinClassroom } from "@/lib/server/classrooms";
import { clientIp, HttpError, json, parseJson, route } from "@/lib/server/http";
import { getPlayerDTO } from "@/lib/server/players";
import { isRateLimited, LIMITS, rateLimit, recordHit } from "@/lib/server/rate-limit";

export const POST = route(async (req) => {
  const playerId = await requirePlayerId(req);
  rateLimit(`join:${playerId}`, ...LIMITS.join);
  // Only wrong codes count against the IP, so a class sharing one IP can all join,
  // while guessing codes by rotating anonymous sessions is still stopped.
  const failKey = `join-fail:${clientIp(req)}`;
  if (isRateLimited(failKey, LIMITS.joinFailures[0])) {
    throw new HttpError("rate_limited", "Too many wrong codes. Please wait a few minutes and check the code with your teacher.");
  }
  const { code, nickname } = await parseJson(req, joinClassroomSchema);
  const db = await getDb();
  try {
    await joinClassroom(db, playerId, code, nickname);
  } catch (err) {
    if (err instanceof HttpError && err.code === "not_found") recordHit(failKey, LIMITS.joinFailures[1]);
    throw err;
  }
  return json(await getPlayerDTO(db, playerId));
});

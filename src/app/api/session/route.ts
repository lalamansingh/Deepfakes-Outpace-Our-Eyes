import { getDb } from "@/db/client";
import { readPlayerId, setPlayerCookie } from "@/lib/server/auth";
import { clientIp, json, route } from "@/lib/server/http";
import { createPlayer, getPlayerDTO, playerExists, touchPlayer } from "@/lib/server/players";
import { LIMITS, rateLimit } from "@/lib/server/rate-limit";

/** Starts (or resumes) the anonymous player session. */
export const POST = route(async (req) => {
  rateLimit(`session:${clientIp(req)}`, ...LIMITS.session);
  const db = await getDb();
  let id = await readPlayerId(req);
  if (id && !(await playerExists(db, id))) id = null;
  const created = !id;
  if (id) await touchPlayer(db, id);
  else id = await createPlayer(db);
  const res = json(await getPlayerDTO(db, id));
  if (created) await setPlayerCookie(res, id);
  return res;
});

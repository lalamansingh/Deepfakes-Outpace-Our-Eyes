import { eq, sql } from "drizzle-orm";
import type { ClueKind, PlayerDTO } from "@/lib/contracts";
import { type Db, schema } from "@/db/client";
import { currentStreak, dayKey } from "./engine";
import { notFound } from "./http";

const { players, playerSkills, answers, classrooms } = schema;

export async function createPlayer(db: Db): Promise<string> {
  const [row] = await db.insert(players).values({}).returning({ id: players.id });
  return row.id;
}

export async function playerExists(db: Db, id: string): Promise<boolean> {
  const [row] = await db.select({ id: players.id }).from(players).where(eq(players.id, id)).limit(1);
  return Boolean(row);
}

export async function touchPlayer(db: Db, id: string, now = new Date()): Promise<void> {
  await db.update(players).set({ lastSeenAt: now }).where(eq(players.id, id));
}

export async function getPlayerDTO(db: Db, playerId: string, now = new Date()): Promise<PlayerDTO> {
  const [row] = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      streak: players.streak,
      bestStreak: players.bestStreak,
      lastDailyDay: players.lastDailyDay,
      classroomId: classrooms.id,
      classroomName: classrooms.name,
    })
    .from(players)
    .leftJoin(classrooms, eq(classrooms.id, players.classroomId))
    .where(eq(players.id, playerId))
    .limit(1);
  if (!row) throw notFound("Player");

  const [agg] = await db
    .select({
      answered: sql<number>`count(*)::int`,
      correct: sql<number>`coalesce(sum(case when ${answers.correct} then 1 else 0 end), 0)::int`,
      avgConfidence: sql<number>`coalesce(avg(${answers.confidence}), 0)::float8`,
      brier: sql<number | null>`avg(case when ${answers.correct} then power(1 - ${answers.confidence} / 100.0, 2) else power(${answers.confidence} / 100.0, 2) end)::float8`,
    })
    .from(answers)
    .where(eq(answers.playerId, playerId));

  const skills = await db
    .select({ tag: playerSkills.tag, rating: playerSkills.rating, answered: playerSkills.answered })
    .from(playerSkills)
    .where(eq(playerSkills.playerId, playerId))
    .orderBy(playerSkills.rating);

  const answered = Number(agg.answered);
  const correct = Number(agg.correct);
  const accuracy = answered ? correct / answered : 0;
  const avgConfidence = answered ? Number(agg.avgConfidence) / 100 : 0;
  const today = dayKey(now);

  return {
    id: row.id,
    nickname: row.nickname,
    classroom: row.classroomId && row.classroomName ? { id: row.classroomId, name: row.classroomName } : null,
    stats: {
      answered,
      correct,
      accuracy,
      avgConfidence,
      calibrationGap: answered ? avgConfidence - accuracy : 0,
      brier: agg.brier === null ? null : Number(agg.brier),
      streak: currentStreak(row, today),
      bestStreak: row.bestStreak,
      playedToday: row.lastDailyDay === today,
      skills: skills.map((s) => ({ tag: s.tag as ClueKind, rating: Math.round(Number(s.rating)), answered: s.answered })),
    },
  };
}

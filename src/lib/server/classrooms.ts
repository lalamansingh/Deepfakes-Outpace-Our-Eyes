import { randomInt } from "node:crypto";
import { and, count, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { ClassDashboardDTO, ClassroomDTO, ClueKind } from "@/lib/contracts";
import { type Db, schema } from "@/db/client";
import type { StaffSession } from "./auth";
import { currentStreak, dayKey } from "./engine";
import { HttpError, isUniqueViolation, notFound } from "./http";

const { classrooms, players, answers, rounds, clues } = schema;

/** No 0/O or 1/I so codes are easy to read aloud and copy from a projector. */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateJoinCode(): string {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

function toDTO(c: typeof classrooms.$inferSelect, studentCount: number): ClassroomDTO {
  return { id: c.id, name: c.name, joinCode: c.joinCode, studentCount, createdAt: c.createdAt.toISOString() };
}

export async function createClassroom(db: Db, teacherId: string, name: string): Promise<ClassroomDTO> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const [row] = await db.insert(classrooms).values({ teacherId, name, joinCode: generateJoinCode() }).returning();
      return toDTO(row, 0);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new HttpError("internal", "Could not generate a unique join code");
}

export async function listClassrooms(db: Db, teacherId: string): Promise<ClassroomDTO[]> {
  const rows = await db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId)).orderBy(classrooms.createdAt);
  if (rows.length === 0) return [];
  const counts = await db
    .select({ classroomId: players.classroomId, n: count() })
    .from(players)
    .where(
      inArray(
        players.classroomId,
        rows.map((r) => r.id),
      ),
    )
    .groupBy(players.classroomId);
  const byId = new Map(counts.map((c) => [c.classroomId, Number(c.n)]));
  return rows.map((r) => toDTO(r, byId.get(r.id) ?? 0));
}

export async function joinClassroom(db: Db, playerId: string, code: string, nickname: string): Promise<void> {
  const [room] = await db.select({ id: classrooms.id }).from(classrooms).where(eq(classrooms.joinCode, code)).limit(1);
  if (!room) throw notFound("Class");
  try {
    await db.update(players).set({ classroomId: room.id, nickname }).where(eq(players.id, playerId));
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError("conflict", "That nickname is already taken in this class. Try another one.");
    throw err;
  }
}

const accuracySql = sql<number>`coalesce(avg(case when ${answers.correct} then 1.0 else 0.0 end), 0)::float8`;

/** Monday (UTC) of the week containing `d`, as YYYY-MM-DD — matches Postgres date_trunc('week'). */
export function weekStart(d: Date): string {
  const day = (d.getUTCDay() + 6) % 7;
  return dayKey(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day)));
}

export async function classDashboard(db: Db, classroomId: string, staff: StaffSession, now = new Date()): Promise<ClassDashboardDTO> {
  const [room] = await db.select().from(classrooms).where(eq(classrooms.id, classroomId)).limit(1);
  if (!room) throw notFound("Class");
  if (room.teacherId !== staff.id && staff.role !== "admin") throw new HttpError("forbidden", "This is not your class");

  const inClass = eq(players.classroomId, classroomId);

  const studentRows = await db
    .select({
      id: players.id,
      nickname: players.nickname,
      streak: players.streak,
      lastDailyDay: players.lastDailyDay,
      answered: sql<number>`count(${answers.id})::int`,
      correct: sql<number>`coalesce(sum(case when ${answers.correct} then 1 else 0 end), 0)::int`,
      avgConfidence: sql<number>`coalesce(avg(${answers.confidence}), 0)::float8`,
      lastActive: sql<string | null>`max(${answers.createdAt})`,
    })
    .from(players)
    .leftJoin(answers, eq(answers.playerId, players.id))
    .where(inClass)
    .groupBy(players.id);

  const today = dayKey(now);
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const students = studentRows.map((s) => {
    const answered = Number(s.answered);
    const accuracy = answered ? Number(s.correct) / answered : 0;
    const lastActive = s.lastActive ? new Date(s.lastActive) : null;
    return {
      id: s.id,
      nickname: s.nickname ?? "Anonymous",
      answered,
      accuracy,
      calibrationGap: answered ? Number(s.avgConfidence) / 100 - accuracy : 0,
      streak: currentStreak(s, today),
      lastActive: lastActive ? lastActive.toISOString() : null,
      correct: Number(s.correct),
      confidenceSum: Number(s.avgConfidence) * answered,
    };
  });

  const totalAnswered = students.reduce((n, s) => n + s.answered, 0);
  const totalCorrect = students.reduce((n, s) => n + s.correct, 0);
  const classAccuracy = totalAnswered ? totalCorrect / totalAnswered : 0;
  const classConfidence = totalAnswered ? students.reduce((n, s) => n + s.confidenceSum, 0) / totalAnswered / 100 : 0;

  // ---- accuracy by ISO week, last 8 weeks (gaps filled with zeros)
  const firstWeek = new Date(`${weekStart(now)}T00:00:00Z`);
  firstWeek.setUTCDate(firstWeek.getUTCDate() - 7 * 7);
  const weekExpr = sql<string>`to_char(date_trunc('week', ${answers.createdAt} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const weekly = await db
    .select({ week: weekExpr, answered: sql<number>`count(*)::int`, accuracy: accuracySql })
    .from(answers)
    .innerJoin(players, eq(players.id, answers.playerId))
    .where(and(inClass, gte(answers.createdAt, firstWeek)))
    .groupBy(weekExpr);
  const weekMap = new Map(weekly.map((w) => [w.week, w]));
  const accuracyByWeek = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(firstWeek);
    d.setUTCDate(d.getUTCDate() + i * 7);
    const key = dayKey(d);
    const w = weekMap.get(key);
    return { weekStart: key, answered: w ? Number(w.answered) : 0, accuracy: w ? Number(w.accuracy) : 0 };
  });

  // ---- accuracy per clue kind (each answer counts once per distinct kind on its item)
  const itemKinds = db.selectDistinct({ itemId: clues.itemId, kind: clues.kind }).from(clues).as("item_kinds");
  const byTag = await db
    .select({ tag: itemKinds.kind, answered: sql<number>`count(*)::int`, accuracy: accuracySql })
    .from(answers)
    .innerJoin(players, eq(players.id, answers.playerId))
    .innerJoin(itemKinds, eq(itemKinds.itemId, answers.itemId))
    .where(inClass)
    .groupBy(itemKinds.kind);
  const accuracyByTag = byTag
    .map((t) => ({ tag: t.tag as ClueKind, answered: Number(t.answered), accuracy: Number(t.accuracy) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered);

  // ---- pre / post assessment
  const assessment = async (kind: "assessment_pre" | "assessment_post") => {
    const [row] = await db
      .select({ students: sql<number>`count(distinct ${players.id})::int`, accuracy: accuracySql })
      .from(rounds)
      .innerJoin(players, eq(players.id, rounds.playerId))
      .innerJoin(answers, eq(answers.roundId, rounds.id))
      .where(and(inClass, eq(rounds.kind, kind), isNotNull(rounds.completedAt)));
    return Number(row?.students ?? 0) > 0 ? { students: Number(row.students), accuracy: Number(row.accuracy) } : null;
  };

  return {
    classroom: toDTO(room, students.length),
    kpis: {
      activeStudents: students.filter((s) => s.lastActive && new Date(s.lastActive).getTime() >= weekAgo).length,
      totalStudents: students.length,
      accuracy: classAccuracy,
      calibrationGap: totalAnswered ? classConfidence - classAccuracy : 0,
      avgStreak: students.length ? students.reduce((n, s) => n + s.streak, 0) / students.length : 0,
    },
    accuracyByWeek,
    accuracyByTag,
    prePost: { pre: await assessment("assessment_pre"), post: await assessment("assessment_post") },
    students: students
      .map(({ correct: _c, confidenceSum: _s, ...rest }) => rest)
      .sort((a, b) => b.answered - a.answered || a.nickname.localeCompare(b.nickname)),
  };
}

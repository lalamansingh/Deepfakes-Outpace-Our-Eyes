/** Rounds: creating them with the adaptive engine, answering items and completing. */
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type {
  AnswerInput,
  AnswerResultDTO,
  ClueDTO,
  ClueKind,
  Label,
  PlayItemDTO,
  RoundDTO,
  RoundKind,
  RoundSummaryDTO,
} from "@/lib/contracts";
import { ROUND_SIZE } from "@/lib/contracts";
import { type Db, schema } from "@/db/client";
import {
  type Candidate,
  currentStreak,
  dayKey,
  insightFor,
  K_PLAYER,
  nextStreak,
  pointsFor,
  seededRandom,
  selectRoundItems,
  type SeenInfo,
  shuffle,
  summarise,
  updateRatings,
  weakestTags,
} from "./engine";
import { HttpError, isUniqueViolation, notFound } from "./http";

const { items, clues, rounds, answers, players, playerSkills } = schema;
type RoundRow = typeof rounds.$inferSelect;
type ItemRow = typeof items.$inferSelect;
type ClueRow = typeof clues.$inferSelect;

// ---------------------------------------------------------------- loading helpers

async function cluesByItem(db: Db, itemIds: string[]): Promise<Map<string, ClueRow[]>> {
  const map = new Map<string, ClueRow[]>();
  if (itemIds.length === 0) return map;
  const rows = await db.select().from(clues).where(inArray(clues.itemId, itemIds)).orderBy(asc(clues.position));
  for (const r of rows) map.set(r.itemId, [...(map.get(r.itemId) ?? []), r]);
  return map;
}

const toClueDTO = (c: ClueRow): ClueDTO => ({ id: c.id, kind: c.kind, title: c.title, explanation: c.explanation, region: c.region ?? null });

const tagsOf = (list: ClueRow[] | undefined): ClueKind[] => [...new Set((list ?? []).map((c) => c.kind))];

function toPlayItem(it: ItemRow): PlayItemDTO {
  return { id: it.id, mediaType: it.mediaType, mediaUrl: it.mediaUrl, width: it.width, height: it.height, category: it.category };
}

function toAnswerResult(
  a: typeof answers.$inferSelect,
  it: ItemRow,
  itemClues: ClueRow[],
  progress: { answered: number; total: number },
): AnswerResultDTO {
  return {
    itemId: it.id,
    guess: a.guess,
    confidence: a.confidence,
    correct: a.correct,
    label: it.label,
    points: a.points,
    clues: itemClues.map(toClueDTO),
    source: {
      name: it.sourceName,
      url: it.sourceUrl,
      license: it.license,
      licenseUrl: it.licenseUrl,
      attribution: it.attribution,
      generator: it.generator,
    },
    progress,
  };
}

async function loadOwnedRound(db: Db, playerId: string, roundId: string): Promise<RoundRow> {
  const [round] = await db
    .select()
    .from(rounds)
    .where(and(eq(rounds.id, roundId), eq(rounds.playerId, playerId)))
    .limit(1);
  if (!round) throw notFound("Round");
  return round;
}

export async function toRoundDTO(db: Db, round: RoundRow): Promise<RoundDTO> {
  const itemRows = round.itemIds.length ? await db.select().from(items).where(inArray(items.id, round.itemIds)) : [];
  const byId = new Map(itemRows.map((i) => [i.id, i]));
  const answerRows = await db.select().from(answers).where(eq(answers.roundId, round.id));
  const answerByItem = new Map(answerRows.map((a) => [a.itemId, a]));
  const clueMap = await cluesByItem(
    db,
    answerRows.map((a) => a.itemId),
  );
  const total = round.itemIds.length;
  const ordered = round.itemIds.map((id) => byId.get(id)).filter((i): i is ItemRow => Boolean(i));
  let answered = 0;
  const results: AnswerResultDTO[] = [];
  for (const it of ordered) {
    const a = answerByItem.get(it.id);
    if (!a) continue;
    answered++;
    results.push(toAnswerResult(a, it, clueMap.get(it.id) ?? [], { answered, total }));
  }
  return {
    id: round.id,
    kind: round.kind,
    dayKey: round.dayKey,
    items: ordered.map(toPlayItem),
    answers: results,
    completedAt: round.completedAt ? round.completedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------- creating rounds

/** Open rounds older than this no longer reserve their items (abandoned rounds must not lock the library). */
const OPEN_ROUND_RESERVATION_MS = 2 * 86_400_000;

async function existingRound(db: Db, playerId: string, kind: RoundKind, now: Date): Promise<RoundRow | undefined> {
  const conds = [eq(rounds.playerId, playerId), eq(rounds.kind, kind)];
  if (kind === "daily") conds.push(eq(rounds.dayKey, dayKey(now)));
  // Practice resumes the player's recent unfinished round instead of piling up new ones.
  if (kind === "practice") {
    conds.push(isNull(rounds.completedAt), gte(rounds.createdAt, new Date(now.getTime() - OPEN_ROUND_RESERVATION_MS)));
  }
  const [row] = await db
    .select()
    .from(rounds)
    .where(and(...conds))
    .orderBy(desc(rounds.createdAt))
    .limit(1);
  return row;
}

/**
 * Unanswered items in the player's recent unfinished rounds. They are kept out of
 * new rounds, otherwise answering one round would reveal another round's answers.
 */
async function itemsReservedByOpenRounds(db: Db, playerId: string, now: Date): Promise<Set<string>> {
  const open = await db
    .select({ id: rounds.id, itemIds: rounds.itemIds })
    .from(rounds)
    .where(
      and(
        eq(rounds.playerId, playerId),
        isNull(rounds.completedAt),
        gte(rounds.createdAt, new Date(now.getTime() - OPEN_ROUND_RESERVATION_MS)),
      ),
    );
  if (open.length === 0) return new Set();
  const answered = await db
    .select({ itemId: answers.itemId })
    .from(answers)
    .where(
      inArray(
        answers.roundId,
        open.map((r) => r.id),
      ),
    );
  const done = new Set(answered.map((a) => a.itemId));
  return new Set(open.flatMap((r) => r.itemIds).filter((id) => !done.has(id)));
}

async function playerHistory(db: Db, playerId: string): Promise<Map<string, SeenInfo>> {
  const rows = await db
    .selectDistinctOn([answers.itemId], { itemId: answers.itemId, createdAt: answers.createdAt, correct: answers.correct })
    .from(answers)
    .where(eq(answers.playerId, playerId))
    .orderBy(answers.itemId, desc(answers.createdAt));
  return new Map(rows.map((r) => [r.itemId, { lastSeenAt: r.createdAt, lastCorrect: r.correct }]));
}

async function playerSkillMap(db: Db, playerId: string): Promise<Map<ClueKind, { rating: number; answered: number }>> {
  const rows = await db.select().from(playerSkills).where(eq(playerSkills.playerId, playerId));
  return new Map(rows.map((r) => [r.tag, { rating: Number(r.rating), answered: r.answered }]));
}

async function chooseItems(db: Db, playerId: string, kind: RoundKind, today: string, now: Date): Promise<string[]> {
  if (kind === "assessment_pre" || kind === "assessment_post") {
    const set = kind === "assessment_pre" ? "A" : "B";
    const rows = await db
      .select({ id: items.id })
      .from(items)
      .where(and(eq(items.status, "published"), eq(items.assessmentSet, set)));
    return shuffle(
      rows.map((r) => r.id),
      seededRandom(`${playerId}|${kind}`),
    );
  }

  const busy = await itemsReservedByOpenRounds(db, playerId, now);
  const pool = (
    await db
      .select()
      .from(items)
      .where(and(eq(items.status, "published"), isNull(items.assessmentSet)))
  ).filter((i) => !busy.has(i.id));
  const clueMap = await cluesByItem(
    db,
    pool.map((i) => i.id),
  );
  const candidates: Candidate[] = pool.map((i) => ({
    id: i.id,
    label: i.label,
    category: i.category,
    rating: Number(i.rating),
    tags: tagsOf(clueMap.get(i.id)),
  }));
  return selectRoundItems({
    candidates,
    skills: await playerSkillMap(db, playerId),
    history: await playerHistory(db, playerId),
    now,
    size: ROUND_SIZE,
    rng: seededRandom(kind === "daily" ? `${playerId}|${today}` : randomUUID()),
  });
}

/**
 * Daily rounds are idempotent per UTC day; assessments can each be taken once;
 * practice resumes the unfinished practice round, or starts a fresh one.
 */
export async function createRound(db: Db, playerId: string, kind: RoundKind, now = new Date()): Promise<RoundDTO> {
  const today = dayKey(now);
  const existing = await existingRound(db, playerId, kind, now);
  if (existing) {
    if (kind.startsWith("assessment") && existing.completedAt) throw new HttpError("conflict", "You have already completed this check");
    return toRoundDTO(db, existing);
  }

  const itemIds = await chooseItems(db, playerId, kind, today, now);
  if (itemIds.length === 0) {
    throw new HttpError(
      "conflict",
      kind.startsWith("assessment") ? "This check is not available yet" : "No new items are available right now. Please come back later.",
    );
  }

  try {
    const [round] = await db.insert(rounds).values({ playerId, kind, dayKey: today, itemIds, createdAt: now }).returning();
    return await toRoundDTO(db, round);
  } catch (err) {
    // Two tabs raced to create today's round or an assessment: return the winner.
    if (isUniqueViolation(err) && kind !== "practice") {
      const existing = await existingRound(db, playerId, kind, now);
      if (existing) return toRoundDTO(db, existing);
    }
    throw err;
  }
}

export async function getRound(db: Db, playerId: string, roundId: string): Promise<RoundDTO> {
  return toRoundDTO(db, await loadOwnedRound(db, playerId, roundId));
}

// ---------------------------------------------------------------- answering

export async function answerItem(db: Db, playerId: string, roundId: string, input: AnswerInput, now = new Date()): Promise<AnswerResultDTO> {
  const round = await loadOwnedRound(db, playerId, roundId);
  if (round.completedAt) throw new HttpError("conflict", "This round is already complete");
  if (!round.itemIds.includes(input.itemId)) throw new HttpError("validation_error", "That item is not part of this round");

  const [item] = await db.select().from(items).where(eq(items.id, input.itemId)).limit(1);
  if (!item) throw notFound("Item");
  const itemClues = (await cluesByItem(db, [item.id])).get(item.id) ?? [];
  const tags = tagsOf(itemClues);
  const correct = input.guess === item.label;
  const points = pointsFor(correct, input.confidence);

  try {
    const answer = await db.transaction(async (tx) => {
      const skillRows = tags.length
        ? await tx
            .select()
            .from(playerSkills)
            .where(and(eq(playerSkills.playerId, playerId), inArray(playerSkills.tag, tags)))
        : [];
      const skills = new Map(skillRows.map((s) => [s.tag, Number(s.rating)]));
      const update = updateRatings(tags, skills, Number(item.rating), correct);
      const delta = (correct ? 1 : 0) - update.expected;

      const [inserted] = await tx
        .insert(answers)
        .values({
          roundId,
          playerId,
          itemId: item.id,
          guess: input.guess,
          confidence: input.confidence,
          correct,
          points,
          responseMs: input.responseMs,
          createdAt: now,
        })
        .returning();

      // Relative updates so concurrent answers by other players never overwrite each other.
      await tx
        .update(items)
        .set({
          timesShown: sql`${items.timesShown} + 1`,
          timesCorrect: sql`${items.timesCorrect} + ${correct ? 1 : 0}`,
          rating: sql`${items.rating} + ${update.itemRating - Number(item.rating)}`,
        })
        .where(eq(items.id, item.id));

      for (const tag of tags) {
        await tx
          .insert(playerSkills)
          .values({ playerId, tag, rating: update.skills.get(tag)!, answered: 1 })
          .onConflictDoUpdate({
            target: [playerSkills.playerId, playerSkills.tag],
            set: {
              rating: sql`${playerSkills.rating} + ${K_PLAYER * delta}`,
              answered: sql`${playerSkills.answered} + 1`,
            },
          });
      }
      await tx.update(players).set({ lastSeenAt: now }).where(eq(players.id, playerId));
      return inserted;
    });

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(answers)
      .where(eq(answers.roundId, roundId));
    return toAnswerResult(answer, item, itemClues, { answered: Number(count), total: round.itemIds.length });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError("conflict", "You already answered this item");
    throw err;
  }
}

// ---------------------------------------------------------------- completing

export async function completeRound(db: Db, playerId: string, roundId: string, now = new Date()): Promise<RoundSummaryDTO> {
  const round = await loadOwnedRound(db, playerId, roundId);
  const rows = await db
    .select({ correct: answers.correct, confidence: answers.confidence, itemId: answers.itemId, label: items.label })
    .from(answers)
    .innerJoin(items, eq(items.id, answers.itemId))
    .where(eq(answers.roundId, roundId));
  if (rows.length < round.itemIds.length) throw new HttpError("validation_error", "Answer every item before finishing the round");

  const clueMap = await cluesByItem(
    db,
    rows.map((r) => r.itemId),
  );
  const scored = rows.map((r) => ({ correct: r.correct, confidence: r.confidence, label: r.label as Label, tags: tagsOf(clueMap.get(r.itemId)) }));
  const s = summarise(scored);

  const player = await db.transaction(async (tx) => {
    const [first] = await tx
      .update(rounds)
      .set({ completedAt: now, score: s.score })
      .where(and(eq(rounds.id, roundId), isNull(rounds.completedAt)))
      .returning({ id: rounds.id });
    const [p] = await tx.select().from(players).where(eq(players.id, playerId)).limit(1);
    // Streaks count the day the daily round belongs to, once, and never move backwards.
    if (first && round.kind === "daily" && (!p.lastDailyDay || round.dayKey >= p.lastDailyDay)) {
      const next = nextStreak(p, round.dayKey);
      await tx.update(players).set(next).where(eq(players.id, playerId));
      return { ...p, ...next };
    }
    return p;
  });

  return {
    roundId,
    kind: round.kind,
    score: s.score,
    maxScore: s.maxScore,
    correct: s.correct,
    total: s.total,
    accuracy: s.accuracy,
    avgConfidence: s.avgConfidence,
    calibrationGap: s.calibrationGap,
    brier: s.brier,
    insight: insightFor(scored),
    weakestTags: weakestTags(scored),
    streak: currentStreak(player, dayKey(now)),
    bestStreak: player.bestStreak,
  };
}

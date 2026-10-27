/**
 * The learning engine: pure, deterministic functions with no I/O.
 * - Elo-style ratings for players (per clue kind) and items (difficulty)
 * - adaptive item selection for a round
 * - scoring, calibration and the end-of-round insight
 * - UTC day keys and streaks
 */
import type { ClueKind, Label } from "@/lib/contracts";
import { CONFIDENCE_MAX, CONFIDENCE_MIN } from "@/lib/contracts";

// ---------------------------------------------------------------- ratings

export const BASE_RATING = 1500;
export const K_PLAYER = 32;
export const K_ITEM = 16;
/** Success probability we aim for: hard enough to learn, easy enough to stay motivated. */
export const TARGET_SUCCESS = 0.65;

/** Probability that a player with `player` rating answers an item with `item` difficulty correctly. */
export function expectedSuccess(player: number, item: number): number {
  return 1 / (1 + 10 ** ((item - player) / 400));
}

/** Mean of the player's skill ratings across the item's tags (BASE_RATING for unknown tags). */
export function playerRatingFor(tags: readonly ClueKind[], skills: ReadonlyMap<ClueKind, number>): number {
  if (tags.length === 0) return BASE_RATING;
  return tags.reduce((sum, t) => sum + (skills.get(t) ?? BASE_RATING), 0) / tags.length;
}

/**
 * Elo update after one answer. Every tag of the item moves by the same amount
 * (the item's tags are all evidence for or against the player's skill), and the
 * item moves the opposite way at a slower rate.
 */
export function updateRatings(
  tags: readonly ClueKind[],
  skills: ReadonlyMap<ClueKind, number>,
  itemRating: number,
  correct: boolean,
): { skills: Map<ClueKind, number>; itemRating: number; expected: number } {
  const expected = expectedSuccess(playerRatingFor(tags, skills), itemRating);
  const outcome = correct ? 1 : 0;
  const delta = outcome - expected;
  const next = new Map<ClueKind, number>();
  for (const t of new Set(tags)) next.set(t, (skills.get(t) ?? BASE_RATING) + K_PLAYER * delta);
  return { skills: next, itemRating: itemRating - K_ITEM * delta, expected };
}

// ---------------------------------------------------------------- randomness

/** Small, fast, seedable PRNG (mulberry32). Returns floats in [0, 1). */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: readonly T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------- selection

export type Candidate = {
  id: string;
  label: Label;
  category: string;
  rating: number;
  tags: ClueKind[];
};

export type SeenInfo = { lastSeenAt: Date; lastCorrect: boolean };

export type SelectOptions = {
  candidates: readonly Candidate[];
  skills: ReadonlyMap<ClueKind, { rating: number; answered: number }>;
  history: ReadonlyMap<string, SeenInfo>;
  now: Date;
  size: number;
  rng: () => number;
};

const DAY_MS = 86_400_000;
/** Correctly answered items rest this long before they can return. */
export const REST_DAYS_CORRECT = 7;
/** Missed items come back for review after this long (spaced repetition). */
export const REVIEW_AFTER_DAYS_MISSED = 1;
/** No category may take more than this share of a round. */
const MAX_CATEGORY_SHARE = 0.4;

/**
 * Picks `size` items for a round and returns their ids in play order.
 *
 * 1. Eligibility: unseen items; missed items due for review; correct items after
 *    their rest period. If that is not enough, the least recently seen fill in.
 * 2. Score: closeness of the predicted success to TARGET_SUCCESS, a bonus for
 *    the player's weakest or least-practised clue kinds, a bonus for due reviews
 *    and for novelty, plus a little randomness so rounds feel fresh.
 * 3. Greedy pick under balance constraints: the number of AI items is drawn at
 *    random (binomial, never all one label), so after seeing earlier answers a
 *    player still cannot deduce the remaining ones; no category dominates.
 * 4. Shuffle so position never hints at the answer.
 */
export function selectRoundItems(opts: SelectOptions): string[] {
  const { candidates, skills, history, now, rng } = opts;
  const size = Math.min(opts.size, candidates.length);
  if (size <= 0) return [];

  const ratings = new Map<ClueKind, number>();
  skills.forEach((s, tag) => ratings.set(tag, s.rating));

  const ageDays = (c: Candidate) => {
    const seen = history.get(c.id);
    return seen ? (now.getTime() - seen.lastSeenAt.getTime()) / DAY_MS : Infinity;
  };
  const isEligible = (c: Candidate) => {
    const seen = history.get(c.id);
    if (!seen) return true;
    return seen.lastCorrect ? ageDays(c) >= REST_DAYS_CORRECT : ageDays(c) >= REVIEW_AFTER_DAYS_MISSED;
  };

  let pool = candidates.filter(isEligible);
  if (pool.length < size) {
    const rest = candidates
      .filter((c) => !pool.includes(c))
      .sort((a, b) => ageDays(b) - ageDays(a))
      .slice(0, size - pool.length);
    pool = [...pool, ...rest];
  }

  const score = (c: Candidate) => {
    const expected = expectedSuccess(playerRatingFor(c.tags, ratings), c.rating);
    const fit = 1 - Math.abs(expected - TARGET_SUCCESS); // 0.35 .. 1
    let weakness = 0;
    for (const t of c.tags) {
      const s = skills.get(t);
      const gap = Math.min(Math.max((BASE_RATING - (s?.rating ?? BASE_RATING)) / 400, 0), 0.5);
      const practice = !s || s.answered < 3 ? 0.2 : 0;
      weakness = Math.max(weakness, gap + practice);
    }
    const seen = history.get(c.id);
    const review = seen && !seen.lastCorrect ? 0.3 : 0;
    const novelty = seen ? 0 : 0.2;
    return fit + weakness + review + novelty + rng() * 0.25;
  };

  const ranked = pool.map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s);

  const aiTarget = aiCountFor(size, rng);
  const labelQuota: Record<Label, number> = { ai: aiTarget, real: size - aiTarget };
  const maxPerCategory = Math.max(1, Math.ceil(size * MAX_CATEGORY_SHARE));

  const pick = (respectCategory: boolean, respectLabels: boolean): Candidate[] => {
    const chosen: Candidate[] = [];
    const labelCount: Record<Label, number> = { real: 0, ai: 0 };
    const catCount = new Map<string, number>();
    for (const { c } of ranked) {
      if (chosen.length === size) break;
      if (respectLabels && labelCount[c.label] >= labelQuota[c.label]) continue;
      if (respectCategory && (catCount.get(c.category) ?? 0) >= maxPerCategory) continue;
      chosen.push(c);
      labelCount[c.label]++;
      catCount.set(c.category, (catCount.get(c.category) ?? 0) + 1);
    }
    return chosen;
  };

  // Relax constraints only when the content library cannot satisfy them.
  let chosen = pick(true, true);
  if (chosen.length < size) chosen = pick(false, true);
  if (chosen.length < size) chosen = pick(false, false);
  return shuffle(
    chosen.map((c) => c.id),
    rng,
  );
}

export type SpotPuzzle = { itemIds: string[]; oddId: string; find: Label };

const flip = (l: Label): Label => (l === "ai" ? "real" : "ai");

/**
 * Builds "spot the odd one out" puzzles: each has `grid` items where exactly one
 * (the odd one) has the label the player must find. The rest share one category
 * with the odd item whenever the library allows, so the comparison is fair.
 * Items the player has not seen recently are preferred; no item repeats in a round.
 * The label to find is random per puzzle, and the odd item's position is shuffled.
 */
export function buildSpotPuzzles(opts: {
  candidates: readonly Candidate[];
  history: ReadonlyMap<string, SeenInfo>;
  now: Date;
  puzzles: number;
  grid: number;
  rng: () => number;
}): SpotPuzzle[] {
  const { candidates, history, now, puzzles, grid, rng } = opts;
  const freshness = (c: Candidate) => {
    const seen = history.get(c.id);
    const ageDays = seen ? (now.getTime() - seen.lastSeenAt.getTime()) / DAY_MS : Infinity;
    return (ageDays >= REST_DAYS_CORRECT ? 1 : 0) + rng() * 0.5;
  };
  // Freshest first, with randomness so puzzles differ from round to round.
  const ordered = candidates
    .map((c) => ({ c, f: freshness(c) }))
    .sort((a, b) => b.f - a.f)
    .map((x) => x.c);
  const used = new Set<string>();
  const out: SpotPuzzle[] = [];

  const tryBuild = (find: Label): SpotPuzzle | null => {
    const odds = ordered.filter((c) => c.label === find && !used.has(c.id));
    const others = ordered.filter((c) => c.label === flip(find) && !used.has(c.id));
    if (odds.length === 0 || others.length < grid - 1) return null;
    for (const odd of odds) {
      const sameCat = others.filter((c) => c.category === odd.category);
      if (sameCat.length >= grid - 1) return { oddId: odd.id, find, itemIds: [odd.id, ...sameCat.slice(0, grid - 1).map((c) => c.id)] };
    }
    // No category has enough: fall back to the freshest odd item with any others.
    return { oddId: odds[0].id, find, itemIds: [odds[0].id, ...others.slice(0, grid - 1).map((c) => c.id)] };
  };

  for (let i = 0; i < puzzles; i++) {
    const first: Label = rng() < 0.5 ? "ai" : "real";
    const puzzle = tryBuild(first) ?? tryBuild(flip(first));
    if (!puzzle) break;
    puzzle.itemIds.forEach((id) => used.add(id));
    out.push({ ...puzzle, itemIds: shuffle(puzzle.itemIds, rng) });
  }
  return out;
}

/**
 * How many AI items a round gets: Binomial(size, ½), re-drawn until both labels
 * appear (for rounds of 4+). The count varies round to round, so players cannot
 * count their way to the last answers.
 */
export function aiCountFor(size: number, rng: () => number): number {
  if (size < 4) return Math.round(size * rng());
  for (;;) {
    let n = 0;
    for (let i = 0; i < size; i++) if (rng() < 0.5) n++;
    if (n > 0 && n < size) return n;
  }
}

// ---------------------------------------------------------------- scoring

/** Correct: +confidence (50..100). Wrong: −(confidence − 50) (0..−50). Rewards honest uncertainty. */
export function pointsFor(correct: boolean, confidence: number): number {
  const c = clampConfidence(confidence);
  return correct ? c : CONFIDENCE_MIN - c;
}

export function clampConfidence(confidence: number): number {
  return Math.min(Math.max(Math.round(confidence), CONFIDENCE_MIN), CONFIDENCE_MAX);
}

/** Brier score of one answer: squared error of the probability given to the true label (0 best, 1 worst). */
export function brierFor(correct: boolean, confidence: number): number {
  const p = clampConfidence(confidence) / 100;
  const pTrue = correct ? p : 1 - p;
  return (1 - pTrue) ** 2;
}

export type ScoredAnswer = { correct: boolean; confidence: number; label: Label; tags: readonly ClueKind[] };

export type Calibration = {
  total: number;
  correct: number;
  accuracy: number;
  avgConfidence: number;
  calibrationGap: number;
  brier: number;
  score: number;
  maxScore: number;
};

export function summarise(list: readonly ScoredAnswer[]): Calibration {
  const total = list.length;
  if (total === 0) {
    return { total: 0, correct: 0, accuracy: 0, avgConfidence: 0, calibrationGap: 0, brier: 0, score: 0, maxScore: 0 };
  }
  const correct = list.filter((a) => a.correct).length;
  const accuracy = correct / total;
  const avgConfidence = list.reduce((s, a) => s + clampConfidence(a.confidence), 0) / total / 100;
  const brier = list.reduce((s, a) => s + brierFor(a.correct, a.confidence), 0) / total;
  const score = list.reduce((s, a) => s + pointsFor(a.correct, a.confidence), 0);
  return {
    total,
    correct,
    accuracy,
    avgConfidence,
    calibrationGap: avgConfidence - accuracy,
    brier,
    score,
    maxScore: total * CONFIDENCE_MAX,
  };
}

/** Clue kinds the player missed most in this round (most misses first, at most 3). */
export function weakestTags(list: readonly ScoredAnswer[]): ClueKind[] {
  const misses = new Map<ClueKind, number>();
  for (const a of list) if (!a.correct) for (const t of new Set(a.tags)) misses.set(t, (misses.get(t) ?? 0) + 1);
  return [...misses.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3)
    .map(([t]) => t);
}

export const CALIBRATION_TOLERANCE = 0.1;

/** One or two plain-language sentences of feedback for the end of a round. */
export function insightFor(list: readonly ScoredAnswer[]): string {
  const s = summarise(list);
  if (s.total === 0) return "";
  const pts = Math.round(Math.abs(s.calibrationGap) * 100);
  let first: string;
  if (s.calibrationGap > CALIBRATION_TOLERANCE) {
    first = `You were ${pts} points more sure than you were right. Slow down and check the clues before you decide.`;
  } else if (s.calibrationGap < -CALIBRATION_TOLERANCE) {
    first = `You were right more often than you thought (${pts} points). Trust your eye a little more.`;
  } else {
    first = "Well calibrated: your confidence matched your accuracy.";
  }
  const ai = list.filter((a) => a.label === "ai");
  const real = list.filter((a) => a.label === "real");
  const acc = (xs: readonly ScoredAnswer[]) => (xs.length ? xs.filter((a) => a.correct).length / xs.length : 1);
  let second = "";
  if (ai.length >= 2 && real.length >= 2) {
    const diff = acc(ai) - acc(real);
    if (diff <= -0.25) second = " AI-made items fooled you most: look harder before calling something real.";
    else if (diff >= 0.25) second = " You flagged real photos as fake: not every perfect picture is AI.";
  }
  return first + second;
}

// ---------------------------------------------------------------- days and streaks

/** UTC calendar day as YYYY-MM-DD. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function previousDayKey(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  return dayKey(new Date(d.getTime() - DAY_MS));
}

/** Streak after completing today's daily round. */
export function nextStreak(
  state: { streak: number; bestStreak: number; lastDailyDay: string | null },
  today: string,
): { streak: number; bestStreak: number; lastDailyDay: string } {
  if (state.lastDailyDay === today) return { ...state, lastDailyDay: today };
  const streak = state.lastDailyDay === previousDayKey(today) ? state.streak + 1 : 1;
  return { streak, bestStreak: Math.max(state.bestStreak, streak), lastDailyDay: today };
}

/** The streak to display: it is broken once a full day has been skipped. */
export function currentStreak(state: { streak: number; lastDailyDay: string | null }, today: string): number {
  if (!state.lastDailyDay) return 0;
  return state.lastDailyDay === today || state.lastDailyDay === previousDayKey(today) ? state.streak : 0;
}

import { describe, expect, it } from "vitest";
import type { ClueKind } from "@/lib/contracts";
import {
  aiCountFor,
  BASE_RATING,
  buildSpotPuzzles,
  brierFor,
  type Candidate,
  currentStreak,
  dayKey,
  expectedSuccess,
  insightFor,
  nextStreak,
  playerRatingFor,
  pointsFor,
  previousDayKey,
  seededRandom,
  selectRoundItems,
  shuffle,
  summarise,
  updateRatings,
  weakestTags,
} from "@/lib/server/engine";

describe("ratings", () => {
  it("gives 50% success for equal ratings and is symmetric", () => {
    expect(expectedSuccess(1500, 1500)).toBeCloseTo(0.5, 10);
    expect(expectedSuccess(1600, 1500) + expectedSuccess(1500, 1600)).toBeCloseTo(1, 10);
    expect(expectedSuccess(1900, 1500)).toBeCloseTo(10 / 11, 10); // 400 points = 10:1 odds
  });

  it("averages tag skills and defaults unknown tags", () => {
    const skills = new Map<ClueKind, number>([["lighting", 1600]]);
    expect(playerRatingFor(["lighting", "anatomy"], skills)).toBe(1550);
    expect(playerRatingFor([], skills)).toBe(BASE_RATING);
  });

  it("moves player up and item down on a correct answer, conserving the weighted change", () => {
    const r = updateRatings(["lighting", "texture"], new Map(), 1500, true);
    expect(r.expected).toBeCloseTo(0.5);
    expect(r.skills.get("lighting")).toBeCloseTo(1516);
    expect(r.skills.get("texture")).toBeCloseTo(1516);
    expect(r.itemRating).toBeCloseTo(1492);
  });

  it("moves player down and item up on a wrong answer and de-duplicates tags", () => {
    const r = updateRatings(["anatomy", "anatomy"], new Map(), 1500, false);
    expect([...r.skills.keys()]).toEqual(["anatomy"]);
    expect(r.skills.get("anatomy")).toBeCloseTo(1484);
    expect(r.itemRating).toBeCloseTo(1508);
  });
});

describe("seeded randomness", () => {
  it("is deterministic per seed and stays in [0, 1)", () => {
    const a = seededRandom("player-1|2026-12-01");
    const b = seededRandom("player-1|2026-12-01");
    const xs = Array.from({ length: 1000 }, () => a());
    expect(xs).toEqual(Array.from({ length: 1000 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(seededRandom("other")()).not.toBe(xs[0]);
  });

  it("shuffles without losing or duplicating elements", () => {
    const list = Array.from({ length: 50 }, (_, i) => i);
    const out = shuffle(list, seededRandom("s"));
    expect([...out].sort((x, y) => x - y)).toEqual(list);
    expect(out).not.toEqual(list);
  });
});

function makeCandidates(n: number, overrides: Partial<Candidate> = {}): Candidate[] {
  const cats = ["portrait", "animal", "landscape", "food", "architecture", "object", "scene"];
  const tags: ClueKind[] = ["lighting", "anatomy", "texture", "text", "geometry", "background", "source"];
  return Array.from({ length: n }, (_, i) => ({
    id: `item-${i}`,
    label: i % 2 === 0 ? "real" : "ai",
    category: cats[i % cats.length],
    rating: 1400 + (i % 5) * 50,
    tags: [tags[i % tags.length], tags[(i + 3) % tags.length]],
    ...overrides,
  }));
}

describe("selectRoundItems", () => {
  const now = new Date("2026-12-10T12:00:00Z");

  it("returns the requested number of unique, existing ids", () => {
    const cands = makeCandidates(40);
    const ids = selectRoundItems({ candidates: cands, skills: new Map(), history: new Map(), now, size: 8, rng: seededRandom("x") });
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
    expect(ids.every((id) => cands.some((c) => c.id === id))).toBe(true);
  });

  it("varies the real/AI split so the last answers cannot be deduced, never all one label", () => {
    const cands = makeCandidates(40);
    const splits = new Map<number, number>();
    for (let s = 0; s < 1000; s++) {
      const ids = selectRoundItems({ candidates: cands, skills: new Map(), history: new Map(), now, size: 8, rng: seededRandom(`seed-${s}`) });
      const ai = ids.filter((id) => cands.find((c) => c.id === id)!.label === "ai").length;
      expect(ai).toBeGreaterThanOrEqual(1);
      expect(ai).toBeLessThanOrEqual(7);
      splits.set(ai, (splits.get(ai) ?? 0) + 1);
    }
    // binomial-shaped: every split from 1 to 7 occurs, 4 is the most common, and no split dominates
    expect([...splits.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(Math.max(...splits.values())).toBe(splits.get(4));
    expect(splits.get(4)! / 1000).toBeLessThan(0.35);
  });

  it("caps any single category at 40% of the round", () => {
    const cands = makeCandidates(40);
    for (let s = 0; s < 50; s++) {
      const ids = selectRoundItems({ candidates: cands, skills: new Map(), history: new Map(), now, size: 8, rng: seededRandom(`c-${s}`) });
      const counts = new Map<string, number>();
      ids.forEach((id) => {
        const cat = cands.find((c) => c.id === id)!.category;
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      });
      expect(Math.max(...counts.values())).toBeLessThanOrEqual(4);
    }
  });

  it("avoids recently answered items when enough fresh ones exist", () => {
    const cands = makeCandidates(30);
    const history = new Map(cands.slice(0, 20).map((c) => [c.id, { lastSeenAt: new Date(now.getTime() - 86_400_000), lastCorrect: true }]));
    const ids = selectRoundItems({ candidates: cands, skills: new Map(), history, now, size: 8, rng: seededRandom("h") });
    expect(ids.every((id) => !history.has(id))).toBe(true);
  });

  it("brings missed items back for review after a day", () => {
    const cands = makeCandidates(9);
    // 8 fresh items would fill the round, but the missed item is due and boosted.
    const missed = cands[0];
    const history = new Map([[missed.id, { lastSeenAt: new Date(now.getTime() - 2 * 86_400_000), lastCorrect: false }]]);
    let included = 0;
    for (let s = 0; s < 100; s++) {
      const ids = selectRoundItems({ candidates: cands, skills: new Map(), history, now, size: 8, rng: seededRandom(`r-${s}`) });
      if (ids.includes(missed.id)) included++;
    }
    expect(included).toBeGreaterThan(80);
  });

  it("falls back to the least recently seen items when the library is exhausted", () => {
    const cands = makeCandidates(10);
    const history = new Map(
      cands.map((c, i) => [c.id, { lastSeenAt: new Date(now.getTime() - (i + 1) * 3_600_000), lastCorrect: true }]),
    );
    const ids = selectRoundItems({ candidates: cands, skills: new Map(), history, now, size: 8, rng: seededRandom("f") });
    expect(ids).toHaveLength(8);
    // the two most recently seen (item-0, item-1) are the ones left out
    expect(ids).not.toContain("item-0");
    expect(ids).not.toContain("item-1");
  });

  it("returns fewer items when the library is smaller than a round and nothing when empty", () => {
    expect(selectRoundItems({ candidates: makeCandidates(5), skills: new Map(), history: new Map(), now, size: 8, rng: seededRandom("s") })).toHaveLength(5);
    expect(selectRoundItems({ candidates: [], skills: new Map(), history: new Map(), now, size: 8, rng: seededRandom("s") })).toEqual([]);
  });

  it("relaxes the balance rules when the library is one-sided", () => {
    const cands = makeCandidates(10, { label: "ai", category: "portrait" });
    expect(selectRoundItems({ candidates: cands, skills: new Map(), history: new Map(), now, size: 8, rng: seededRandom("s") })).toHaveLength(8);
  });

  it("favours the player's weakest clue kind", () => {
    const cands: Candidate[] = Array.from({ length: 40 }, (_, i) => ({
      id: `i${i}`,
      label: i % 2 ? "ai" : "real",
      category: ["a", "b", "c", "d", "e"][i % 5],
      rating: 1500,
      tags: [i < 20 ? "lighting" : "text"],
    }));
    const skills = new Map<ClueKind, { rating: number; answered: number }>([
      ["lighting", { rating: 1300, answered: 20 }],
      ["text", { rating: 1500, answered: 20 }],
    ]);
    let weak = 0;
    for (let s = 0; s < 50; s++) {
      const ids = selectRoundItems({ candidates: cands, skills, history: new Map(), now, size: 8, rng: seededRandom(`w-${s}`) });
      weak += ids.filter((id) => Number(id.slice(1)) < 20).length;
    }
    expect(weak / (50 * 8)).toBeGreaterThan(0.6);
  });
});

describe("buildSpotPuzzles", () => {
  const now = new Date("2026-12-10T12:00:00Z");

  it("builds puzzles with exactly one odd item, no repeats, mostly within one category", () => {
    const cands = makeCandidates(48);
    const byId = new Map(cands.map((c) => [c.id, c]));
    const finds = new Set<string>();
    for (let s = 0; s < 100; s++) {
      const puzzles = buildSpotPuzzles({ candidates: cands, history: new Map(), now, puzzles: 4, grid: 4, rng: seededRandom(`spot-${s}`) });
      expect(puzzles).toHaveLength(4);
      const all = puzzles.flatMap((p) => p.itemIds);
      expect(new Set(all).size).toBe(16);
      for (const p of puzzles) {
        finds.add(p.find);
        expect(p.itemIds).toHaveLength(4);
        expect(p.itemIds).toContain(p.oddId);
        const labels = p.itemIds.map((id) => byId.get(id)!.label);
        expect(labels.filter((l) => l === p.find)).toHaveLength(1);
        expect(byId.get(p.oddId)!.label).toBe(p.find);
      }
    }
    expect(finds).toEqual(new Set(["ai", "real"]));
  });

  it("keeps a puzzle inside one category when the library allows", () => {
    const cands: Candidate[] = ["animal", "food"].flatMap((cat) =>
      Array.from({ length: 8 }, (_, i) => ({ id: `${cat}-${i}`, label: (i % 2 ? "ai" : "real") as "ai" | "real", category: cat, rating: 1500, tags: [] })),
    );
    const puzzles = buildSpotPuzzles({ candidates: cands, history: new Map(), now, puzzles: 2, grid: 4, rng: seededRandom("cat") });
    for (const p of puzzles) expect(new Set(p.itemIds.map((id) => id.split("-")[0])).size).toBe(1);
  });

  it("puts the odd item in every position over many rounds", () => {
    const positions = new Set<number>();
    for (let s = 0; s < 50; s++) {
      const [p] = buildSpotPuzzles({ candidates: makeCandidates(20), history: new Map(), now, puzzles: 1, grid: 4, rng: seededRandom(`pos-${s}`) });
      positions.add(p.itemIds.indexOf(p.oddId));
    }
    expect(positions).toEqual(new Set([0, 1, 2, 3]));
  });

  it("stops when the library cannot fill another puzzle", () => {
    const puzzles = buildSpotPuzzles({ candidates: makeCandidates(9), history: new Map(), now, puzzles: 4, grid: 4, rng: seededRandom("small") });
    expect(puzzles.length).toBe(2);
    expect(buildSpotPuzzles({ candidates: [], history: new Map(), now, puzzles: 4, grid: 4, rng: seededRandom("x") })).toEqual([]);
  });
});

describe("aiCountFor", () => {
  it("is binomial-shaped and never all one label for rounds of 4 or more", () => {
    const rng = seededRandom("binomial");
    let sum = 0;
    for (let i = 0; i < 5000; i++) {
      const n = aiCountFor(8, rng);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(7);
      sum += n;
    }
    expect(sum / 5000).toBeCloseTo(4, 1);
  });
});

describe("scoring and calibration", () => {
  it("scores correct answers by confidence and penalises confident mistakes", () => {
    expect(pointsFor(true, 100)).toBe(100);
    expect(pointsFor(true, 50)).toBe(50);
    expect(pointsFor(false, 50)).toBe(0);
    expect(pointsFor(false, 100)).toBe(-50);
    expect(pointsFor(true, 130)).toBe(100); // clamped
    expect(pointsFor(false, 10)).toBe(0);
  });

  it("computes Brier scores for the probability given to the truth", () => {
    expect(brierFor(true, 100)).toBe(0);
    expect(brierFor(false, 100)).toBe(1);
    expect(brierFor(true, 50)).toBeCloseTo(0.25);
    expect(brierFor(false, 50)).toBeCloseTo(0.25);
    expect(brierFor(true, 80)).toBeCloseTo(0.04);
    expect(brierFor(false, 80)).toBeCloseTo(0.64);
  });

  it("summarises a round", () => {
    const s = summarise([
      { correct: true, confidence: 90, label: "ai", tags: ["lighting"] },
      { correct: false, confidence: 80, label: "real", tags: ["texture"] },
      { correct: true, confidence: 70, label: "real", tags: ["text"] },
      { correct: false, confidence: 100, label: "ai", tags: ["anatomy"] },
    ]);
    expect(s.total).toBe(4);
    expect(s.correct).toBe(2);
    expect(s.accuracy).toBe(0.5);
    expect(s.avgConfidence).toBeCloseTo(0.85);
    expect(s.calibrationGap).toBeCloseTo(0.35);
    expect(s.score).toBe(90 - 30 + 70 - 50);
    expect(s.maxScore).toBe(400);
    expect(s.brier).toBeCloseTo((0.01 + 0.64 + 0.09 + 1) / 4);
  });

  it("handles an empty round", () => {
    expect(summarise([])).toMatchObject({ total: 0, accuracy: 0, score: 0, maxScore: 0 });
    expect(insightFor([])).toBe("");
    expect(weakestTags([])).toEqual([]);
  });

  it("lists the most-missed clue kinds", () => {
    expect(
      weakestTags([
        { correct: false, confidence: 80, label: "ai", tags: ["lighting", "texture"] },
        { correct: false, confidence: 80, label: "ai", tags: ["lighting"] },
        { correct: true, confidence: 80, label: "ai", tags: ["text"] },
        { correct: false, confidence: 80, label: "real", tags: ["anatomy", "anatomy"] },
      ]),
    ).toEqual(["lighting", "anatomy", "texture"]);
  });

  it("writes insights for over-, under- and well-calibrated players", () => {
    const over = Array.from({ length: 8 }, (_, i) => ({ correct: i < 4, confidence: 95, label: (i % 2 ? "ai" : "real") as "ai" | "real", tags: [] }));
    expect(insightFor(over)).toMatch(/^You were 45 points more sure than you were right/);
    const under = Array.from({ length: 8 }, () => ({ correct: true, confidence: 55, label: "real" as const, tags: [] }));
    expect(insightFor(under)).toMatch(/^You were right more often than you thought \(45 points\)/);
    const good = Array.from({ length: 4 }, (_, i) => ({ correct: i < 3, confidence: 75, label: "real" as const, tags: [] }));
    expect(insightFor(good)).toBe("Well calibrated: your confidence matched your accuracy.");
  });

  it("adds a label-specific hint when one kind of item fools the player", () => {
    const list = [
      { correct: false, confidence: 70, label: "ai" as const, tags: [] },
      { correct: false, confidence: 70, label: "ai" as const, tags: [] },
      { correct: true, confidence: 70, label: "real" as const, tags: [] },
      { correct: true, confidence: 70, label: "real" as const, tags: [] },
    ];
    expect(insightFor(list)).toContain("AI-made items fooled you most");
  });
});

describe("days and streaks", () => {
  it("uses UTC day keys", () => {
    expect(dayKey(new Date("2026-12-31T23:59:59.999Z"))).toBe("2026-12-31");
    expect(dayKey(new Date("2027-01-01T00:00:00.000Z"))).toBe("2027-01-01");
    expect(previousDayKey("2027-01-01")).toBe("2026-12-31");
    expect(previousDayKey("2028-03-01")).toBe("2028-02-29");
  });

  it("starts, extends, keeps and resets streaks", () => {
    const first = nextStreak({ streak: 0, bestStreak: 0, lastDailyDay: null }, "2026-12-10");
    expect(first).toEqual({ streak: 1, bestStreak: 1, lastDailyDay: "2026-12-10" });
    const second = nextStreak(first, "2026-12-11");
    expect(second).toEqual({ streak: 2, bestStreak: 2, lastDailyDay: "2026-12-11" });
    expect(nextStreak(second, "2026-12-11")).toEqual(second); // same day twice
    expect(nextStreak(second, "2026-12-13")).toEqual({ streak: 1, bestStreak: 2, lastDailyDay: "2026-12-13" });
  });

  it("shows a broken streak as zero", () => {
    expect(currentStreak({ streak: 5, lastDailyDay: "2026-12-10" }, "2026-12-10")).toBe(5);
    expect(currentStreak({ streak: 5, lastDailyDay: "2026-12-09" }, "2026-12-10")).toBe(5);
    expect(currentStreak({ streak: 5, lastDailyDay: "2026-12-08" }, "2026-12-10")).toBe(0);
    expect(currentStreak({ streak: 0, lastDailyDay: null }, "2026-12-10")).toBe(0);
  });
});

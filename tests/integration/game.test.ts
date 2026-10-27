import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AnswerResultDTO, ApiError, PlayerDTO, RoundDTO, RoundSummaryDTO, SpotResultDTO } from "@/lib/contracts";
import { getDb, schema } from "@/db/client";
import { POST as session } from "@/app/api/session/route";
import { GET as me } from "@/app/api/me/route";
import { POST as createRoundRoute } from "@/app/api/rounds/route";
import { GET as getRoundRoute } from "@/app/api/rounds/[id]/route";
import { POST as answerRoute } from "@/app/api/rounds/[id]/answers/route";
import { POST as completeRoute } from "@/app/api/rounds/[id]/complete/route";
import { POST as pickRoute } from "@/app/api/rounds/[id]/picks/route";
import { GET as creditsRoute } from "@/app/api/credits/route";
import { GET as healthRoute } from "@/app/api/health/route";
import { LIMITS, resetRateLimits } from "@/lib/server/rate-limit";
import { answerItem, completeRound, createRound } from "@/lib/server/rounds";
import { pointsFor } from "@/lib/server/engine";
import { Client, seedLibrary } from "./helpers";

async function labelsOf(ids: string[]) {
  const db = await getDb();
  const rows = await db.select({ id: schema.items.id, label: schema.items.label, set: schema.items.assessmentSet }).from(schema.items);
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)!);
}

beforeAll(async () => {
  await seedLibrary(24);
});
beforeEach(() => resetRateLimits());

describe("sessions", () => {
  it("creates an anonymous player once and keeps it via the cookie", async () => {
    const c = new Client();
    const first = await c.call<PlayerDTO>(session, "POST", "/api/session");
    expect(first.status).toBe(200);
    expect(c.cookies.has("rr_player")).toBe(true);
    const cookie = first.headers.getSetCookie()[0];
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    const second = await c.call<PlayerDTO>(session, "POST", "/api/session");
    expect(second.body.id).toBe(first.body.id);
    expect(second.headers.getSetCookie()).toHaveLength(0);
    const profile = await c.call<PlayerDTO>(me, "GET", "/api/me");
    expect(profile.body).toMatchObject({ id: first.body.id, nickname: null, classroom: null });
    expect(profile.body.stats).toMatchObject({ answered: 0, accuracy: 0, brier: null, streak: 0, playedToday: false });
  });

  it("rejects missing and forged sessions", async () => {
    const anon = new Client();
    expect((await anon.call<ApiError>(me, "GET", "/api/me")).status).toBe(401);
    anon.cookies.set("rr_player", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.forged");
    expect((await anon.call(me, "GET", "/api/me")).status).toBe(401);
    // a forged cookie never maps to an existing player: a fresh one is issued
    const s = await anon.call<PlayerDTO>(session, "POST", "/api/session");
    expect(s.status).toBe(200);
    expect(anon.cookies.get("rr_player")).not.toContain("forged");
  });

  it("blocks cross-origin writes", async () => {
    const evil = new Client("https://evil.example");
    const res = await evil.call<ApiError>(session, "POST", "/api/session");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("reports health", async () => {
    const res = await new Client().call<{ ok: boolean }>(healthRoute, "GET", "/api/health");
    expect(res.body.ok).toBe(true);
  });
});

describe("daily round", () => {
  it("plays a full round end to end with correct scoring, no answer leaks and a streak", async () => {
    const c = new Client();
    await c.call(session, "POST", "/api/session");
    const created = await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "daily" } });
    expect(created.status).toBe(200);
    const round = created.body;
    expect(round.items).toHaveLength(8);
    expect(round.answers).toEqual([]);
    // the answer key must never be in a round response before answering
    const serialized = JSON.stringify(round);
    expect(serialized).not.toMatch(/"label"|"clues"|"generator"|"sourceUrl"|Stable Diffusion/);
    // items come only from the playable pool, never the assessment sets
    expect((await labelsOf(round.items.map((i) => i.id))).every((r) => r.set === null)).toBe(true);

    // same round when asked again today
    const again = await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: {} });
    expect(again.body.id).toBe(round.id);

    // finishing early is refused
    const early = await c.call<ApiError>(completeRoute, "POST", `/api/rounds/${round.id}/complete`, { params: { id: round.id } });
    expect(early.status).toBe(400);

    const truth = await labelsOf(round.items.map((i) => i.id));
    let expectedScore = 0;
    for (const [i, item] of round.items.entries()) {
      // answer correctly on even positions, wrongly on odd ones
      const correct = i % 2 === 0;
      const guess = correct ? truth[i].label : truth[i].label === "ai" ? "real" : "ai";
      const confidence = 60 + i * 5;
      const res = await c.call<AnswerResultDTO>(answerRoute, "POST", `/api/rounds/${round.id}/answers`, {
        params: { id: round.id },
        body: { itemId: item.id, guess, confidence, responseMs: 4000 },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ itemId: item.id, guess, confidence, correct, label: truth[i].label });
      expect(res.body.points).toBe(pointsFor(correct, confidence));
      expect(res.body.clues.length).toBeGreaterThan(0);
      expect(res.body.source.license).toBe("CC BY-SA 4.0");
      expect(res.body.progress).toEqual({ answered: i + 1, total: 8 });
      expectedScore += pointsFor(correct, confidence);
    }

    // double answers are refused
    const dup = await c.call<ApiError>(answerRoute, "POST", `/api/rounds/${round.id}/answers`, {
      params: { id: round.id },
      body: { itemId: round.items[0].id, guess: "real", confidence: 50, responseMs: 1 },
    });
    expect(dup.status).toBe(409);

    // resuming shows all answers in order
    const resumed = await c.call<RoundDTO>(getRoundRoute, "GET", `/api/rounds/${round.id}`, { params: { id: round.id } });
    expect(resumed.body.answers.map((a) => a.itemId)).toEqual(round.items.map((i) => i.id));

    const done = await c.call<RoundSummaryDTO>(completeRoute, "POST", `/api/rounds/${round.id}/complete`, { params: { id: round.id } });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ correct: 4, total: 8, accuracy: 0.5, score: expectedScore, maxScore: 800, streak: 1, bestStreak: 1 });
    expect(done.body.avgConfidence).toBeCloseTo((60 + 65 + 70 + 75 + 80 + 85 + 90 + 95) / 8 / 100);
    expect(done.body.insight.length).toBeGreaterThan(10);

    // completing again is idempotent and never double-counts the streak
    const twice = await c.call<RoundSummaryDTO>(completeRoute, "POST", `/api/rounds/${round.id}/complete`, { params: { id: round.id } });
    expect(twice.body.streak).toBe(1);
    expect(twice.body.score).toBe(expectedScore);

    // answering after completion is refused
    const late = await c.call<ApiError>(answerRoute, "POST", `/api/rounds/${round.id}/answers`, {
      params: { id: round.id },
      body: { itemId: round.items[0].id, guess: "real", confidence: 50, responseMs: 1 },
    });
    expect(late.status).toBe(409);

    const profile = await c.call<PlayerDTO>(me, "GET", "/api/me");
    expect(profile.body.stats).toMatchObject({ answered: 8, correct: 4, accuracy: 0.5, streak: 1, bestStreak: 1, playedToday: true });
    expect(profile.body.stats.skills.length).toBeGreaterThan(0);
  });

  it("validates answers", async () => {
    const c = new Client();
    await c.call(session, "POST", "/api/session");
    const round = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "practice" } })).body;
    const post = (body: unknown, raw?: string) =>
      c.call<ApiError>(answerRoute, "POST", `/api/rounds/${round.id}/answers`, { params: { id: round.id }, body: raw ? undefined : body, raw });
    expect((await post({ itemId: round.items[0].id, guess: "maybe", confidence: 70, responseMs: 1 })).status).toBe(400);
    expect((await post({ itemId: round.items[0].id, guess: "ai", confidence: 49, responseMs: 1 })).status).toBe(400);
    expect((await post({ itemId: round.items[0].id, guess: "ai", confidence: 101, responseMs: 1 })).status).toBe(400);
    expect((await post({ itemId: "00000000-0000-4000-8000-000000000000", guess: "ai", confidence: 70, responseMs: 1 })).status).toBe(400);
    expect((await post(undefined, "{not json")).status).toBe(400);
    const badId = await c.call<ApiError>(getRoundRoute, "GET", "/api/rounds/not-a-uuid", { params: { id: "not-a-uuid" } });
    expect(badId.status).toBe(404);
  });

  it("keeps players out of each other's rounds", async () => {
    const a = new Client();
    const b = new Client("http://localhost:3000", "10.0.0.2");
    await a.call(session, "POST", "/api/session");
    await b.call(session, "POST", "/api/session");
    const round = (await a.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "practice" } })).body;
    expect((await b.call(getRoundRoute, "GET", `/api/rounds/${round.id}`, { params: { id: round.id } })).status).toBe(404);
    const steal = await b.call(answerRoute, "POST", `/api/rounds/${round.id}/answers`, {
      params: { id: round.id },
      body: { itemId: round.items[0].id, guess: "ai", confidence: 70, responseMs: 1 },
    });
    expect(steal.status).toBe(404);
  });

  it("never puts an unfinished round's items into another round", async () => {
    const c = new Client();
    await c.call(session, "POST", "/api/session");
    const daily = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "daily" } })).body;
    const practice = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "practice" } })).body;
    const dailyIds = new Set(daily.items.map((i) => i.id));
    expect(practice.items.some((i) => dailyIds.has(i.id))).toBe(false);
  });
});

describe("streaks across days", () => {
  it("extends on consecutive days and resets after a gap", async () => {
    const db = await getDb();
    const [p] = await db.insert(schema.players).values({}).returning();
    const play = async (iso: string) => {
      const now = new Date(iso);
      const round = await createRound(db, p.id, "daily", now);
      const truth = await labelsOf(round.items.map((i) => i.id));
      for (const [i, item] of round.items.entries()) {
        await answerItem(db, p.id, round.id, { itemId: item.id, guess: truth[i].label, confidence: 80, responseMs: 1000 }, now);
      }
      return completeRound(db, p.id, round.id, now);
    };
    expect((await play("2026-12-01T10:00:00Z")).streak).toBe(1);
    expect((await play("2026-12-02T23:30:00Z")).streak).toBe(2);
    const third = await play("2026-12-05T08:00:00Z");
    expect(third.streak).toBe(1);
    expect(third.bestStreak).toBe(2);
  });
});

describe("assessments", () => {
  it("uses only its fixed set and can be taken once", async () => {
    const c = new Client();
    await c.call(session, "POST", "/api/session");
    const pre = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "assessment_pre" } })).body;
    expect(pre.items).toHaveLength(8);
    const truth = await labelsOf(pre.items.map((i) => i.id));
    expect(truth.every((t) => t.set === "A")).toBe(true);
    expect(truth.filter((t) => t.label === "ai")).toHaveLength(4);
    for (const [i, item] of pre.items.entries()) {
      await c.call(answerRoute, "POST", `/api/rounds/${pre.id}/answers`, {
        params: { id: pre.id },
        body: { itemId: item.id, guess: truth[i].label, confidence: 70, responseMs: 100 },
      });
    }
    expect((await c.call(completeRoute, "POST", `/api/rounds/${pre.id}/complete`, { params: { id: pre.id } })).status).toBe(200);
    const retake = await c.call<ApiError>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "assessment_pre" } });
    expect(retake.status).toBe(409);
    const post = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "assessment_post" } })).body;
    expect((await labelsOf(post.items.map((i) => i.id))).every((t) => t.set === "B")).toBe(true);
  });
});

describe("practice rounds", () => {
  it("resumes the open practice round and never locks the library with abandoned rounds", async () => {
    const c = new Client();
    await c.call(session, "POST", "/api/session");
    const first = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "practice" } })).body;
    for (let i = 0; i < 5; i++) {
      const again = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "practice" } })).body;
      expect(again.id).toBe(first.id);
    }
    // a daily round is still possible alongside the open practice round
    const daily = await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "daily" } });
    expect(daily.status).toBe(200);
    expect(daily.body.items.length).toBeGreaterThan(0);
  });

  it("releases items held by rounds abandoned more than two days ago", async () => {
    const db = await getDb();
    const [p] = await db.insert(schema.players).values({}).returning();
    const old = new Date("2026-11-01T10:00:00Z");
    // abandon several old rounds that between them cover the whole library
    for (let i = 0; i < 4; i++) {
      await db.insert(schema.rounds).values({ playerId: p.id, kind: "practice", dayKey: "2026-11-01", itemIds: [], createdAt: old });
      const r = await createRound(db, p.id, "daily", new Date(old.getTime() + i * 86_400_000));
      expect(r.items.length).toBeGreaterThan(0);
    }
    const later = await createRound(db, p.id, "practice", new Date("2026-11-20T10:00:00Z"));
    expect(later.items).toHaveLength(8);
  });
});

describe("spot the odd one out", () => {
  it("plays a full spot round: one odd item per puzzle, no leaks, scored like any answer", async () => {
    const c = new Client("http://localhost:3000", "10.3.3.3");
    await c.call(session, "POST", "/api/session");
    const created = await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "spot" } });
    expect(created.status).toBe(200);
    const round = created.body;
    expect(round.puzzles).toHaveLength(4);
    // which item is odd is never sent before the pick
    expect(JSON.stringify(round)).not.toMatch(/"oddId"|"oddItemId"|"label"|"generator"/);
    const all = round.puzzles!.flatMap((p) => p.itemIds);
    expect(new Set(all).size).toBe(16);
    expect(round.items).toHaveLength(16);

    for (const p of round.puzzles!) {
      const truth = await labelsOf(p.itemIds);
      expect(truth.filter((t) => t.label === p.find)).toHaveLength(1);
      const odd = p.itemIds[truth.findIndex((t) => t.label === p.find)];
      const decoy = p.itemIds.find((id) => id !== odd)!;
      const pickOdd = p.index % 2 === 0;
      const res = await c.call<SpotResultDTO>(pickRoute, "POST", `/api/rounds/${round.id}/picks`, {
        params: { id: round.id },
        body: { puzzle: p.index, itemId: pickOdd ? odd : decoy, confidence: 90, responseMs: 3000 },
      });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ puzzle: p.index, oddItemId: odd, correct: pickOdd, points: pickOdd ? 90 : -40 });
      expect(res.body.items.map((i) => i.itemId)).toEqual(p.itemIds);
      expect(res.body.items.find((i) => i.itemId === odd)!.label).toBe(p.find);
      expect(res.body.progress).toEqual({ answered: p.index + 1, total: 4 });
    }

    // a second pick on the same puzzle is refused, and single-item answers are not allowed here
    const again = await c.call<ApiError>(pickRoute, "POST", `/api/rounds/${round.id}/picks`, {
      params: { id: round.id },
      body: { puzzle: 0, itemId: round.puzzles![0].itemIds[0], confidence: 50, responseMs: 1 },
    });
    expect(again.status).toBe(409);
    const wrongEndpoint = await c.call<ApiError>(answerRoute, "POST", `/api/rounds/${round.id}/answers`, {
      params: { id: round.id },
      body: { itemId: all[0], guess: "ai", confidence: 50, responseMs: 1 },
    });
    expect(wrongEndpoint.status).toBe(400);

    const resumed = await c.call<RoundDTO>(getRoundRoute, "GET", `/api/rounds/${round.id}`, { params: { id: round.id } });
    expect(resumed.body.spotResults.map((r) => r.puzzle)).toEqual([0, 1, 2, 3]);

    const done = await c.call<RoundSummaryDTO>(completeRoute, "POST", `/api/rounds/${round.id}/complete`, { params: { id: round.id } });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ kind: "spot", correct: 2, total: 4, score: 90 + 90 - 40 - 40 });
    // spot rounds never change the daily streak
    expect(done.body.streak).toBe(0);

    const profile = await c.call<PlayerDTO>(me, "GET", "/api/me");
    expect(profile.body.stats).toMatchObject({ answered: 4, correct: 2 });
  });

  it("rejects picks outside the puzzle", async () => {
    const c = new Client("http://localhost:3000", "10.3.3.4");
    await c.call(session, "POST", "/api/session");
    const round = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "spot" } })).body;
    const other = round.puzzles![1].itemIds[0];
    const post = (body: unknown) => c.call<ApiError>(pickRoute, "POST", `/api/rounds/${round.id}/picks`, { params: { id: round.id }, body });
    expect((await post({ puzzle: 0, itemId: other, confidence: 70, responseMs: 1 })).status).toBe(400);
    expect((await post({ puzzle: 9, itemId: other, confidence: 70, responseMs: 1 })).status).toBe(400);
    // the picks endpoint does not work on ordinary rounds
    const daily = (await c.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "daily" } })).body;
    expect(daily.puzzles).toBeNull();
    const res = await c.call<ApiError>(pickRoute, "POST", `/api/rounds/${daily.id}/picks`, {
      params: { id: daily.id },
      body: { puzzle: 0, itemId: daily.items[0].id, confidence: 70, responseMs: 1 },
    });
    expect(res.status).toBe(400);
  });
});

describe("credits", () => {
  it("lists attributions without labels", async () => {
    const res = await new Client().call<{ credits: { author: string; license: string }[] }>(creditsRoute, "GET", "/api/credits");
    expect(res.body.credits.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/"label"|generator/);
  });
});

describe("rate limiting", () => {
  it("throttles session creation per IP", async () => {
    const c = new Client("http://localhost:3000", "10.9.9.9");
    let last = 0;
    for (let i = 0; i <= LIMITS.session[0]; i++) {
      c.cookies.clear();
      last = (await c.call(session, "POST", "/api/session")).status;
    }
    expect(last).toBe(429);
  });
});

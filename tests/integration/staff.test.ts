import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { AdminItemDTO, AdminStatsDTO, ApiError, ClassDashboardDTO, ClassroomDTO, PlayerDTO, RoundDTO, StaffDTO } from "@/lib/contracts";
import { getDb, schema } from "@/db/client";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as staffMe } from "@/app/api/auth/me/route";
import { GET as listClasses, POST as createClass } from "@/app/api/classrooms/route";
import { GET as dashboard } from "@/app/api/classrooms/[id]/dashboard/route";
import { POST as join } from "@/app/api/classrooms/join/route";
import { POST as session } from "@/app/api/session/route";
import { POST as createRoundRoute } from "@/app/api/rounds/route";
import { POST as answerRoute } from "@/app/api/rounds/[id]/answers/route";
import { POST as completeRoute } from "@/app/api/rounds/[id]/complete/route";
import { GET as stats } from "@/app/api/admin/stats/route";
import { GET as listItemsRoute, POST as createItemRoute } from "@/app/api/admin/items/route";
import { DELETE as archiveRoute, GET as getItemRoute, PATCH as patchRoute } from "@/app/api/admin/items/[id]/route";
import { POST as uploadRoute } from "@/app/api/admin/uploads/route";
import { GET as mediaRoute } from "@/app/api/media/[key]/route";
import { resetRateLimits } from "@/lib/server/rate-limit";
import { eq } from "drizzle-orm";
import { Client, createStaff, itemFixture, seedLibrary } from "./helpers";

process.env.UPLOAD_DIR = mkdtempSync(path.join(os.tmpdir(), "rr-uploads-"));

beforeAll(async () => {
  await seedLibrary(20);
  await createStaff("admin@example.com", "admin-password-123", "admin");
});
beforeEach(() => resetRateLimits());

async function signIn(email: string, password: string) {
  const c = new Client();
  const res = await c.call<StaffDTO>(login, "POST", "/api/auth/login", { body: { email, password } });
  expect(res.status).toBe(200);
  return c;
}

describe("staff auth", () => {
  it("registers a teacher, signs in and out", async () => {
    const c = new Client();
    const reg = await c.call<StaffDTO>(register, "POST", "/api/auth/register", {
      body: { email: "Teacher@School.org ", password: "correct-horse-battery", name: "Ms Rivera" },
    });
    expect(reg.status).toBe(201);
    expect(reg.body).toMatchObject({ email: "teacher@school.org", role: "teacher", name: "Ms Rivera" });
    expect(JSON.stringify(reg.body)).not.toMatch(/password/i);
    expect((await c.call<StaffDTO>(staffMe, "GET", "/api/auth/me")).body.email).toBe("teacher@school.org");
    await c.call(logout, "POST", "/api/auth/logout");
    expect((await c.call(staffMe, "GET", "/api/auth/me")).status).toBe(401);

    const again = await new Client().call<ApiError>(register, "POST", "/api/auth/register", {
      body: { email: "teacher@school.org", password: "another-password-1", name: "Copy" },
    });
    expect(again.status).toBe(409);
  });

  it("rejects weak passwords, wrong passwords and unknown emails with the same message", async () => {
    const weak = await new Client().call<ApiError>(register, "POST", "/api/auth/register", { body: { email: "x@y.org", password: "short", name: "X" } });
    expect(weak.status).toBe(400);
    const wrong = await new Client().call<ApiError>(login, "POST", "/api/auth/login", { body: { email: "admin@example.com", password: "nope-nope-nope" } });
    const unknown = await new Client().call<ApiError>(login, "POST", "/api/auth/login", { body: { email: "ghost@example.com", password: "nope-nope-nope" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("locks out repeated failed logins", async () => {
    const c = new Client("http://localhost:3000", "10.7.7.7");
    let status = 0;
    for (let i = 0; i < 11; i++) {
      status = (await c.call(login, "POST", "/api/auth/login", { body: { email: "admin@example.com", password: `bad-${i}-password` } })).status;
    }
    expect(status).toBe(429);
  });

  it("honours a closed sign-up", async () => {
    process.env.TEACHER_SIGNUP = "closed";
    const res = await new Client().call(register, "POST", "/api/auth/register", { body: { email: "late@school.org", password: "late-password-123", name: "Late" } });
    delete process.env.TEACHER_SIGNUP;
    expect(res.status).toBe(403);
  });
});

describe("classrooms", () => {
  it("lets a teacher run a class and see accurate analytics", async () => {
    await createStaff("t1@school.org", "teacher-one-pass", "teacher");
    const teacher = await signIn("t1@school.org", "teacher-one-pass");
    const created = await teacher.call<ClassroomDTO>(createClass, "POST", "/api/classrooms", { body: { name: "10B Media" } });
    expect(created.status).toBe(201);
    expect(created.body.joinCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // two students join and play
    const studentAnswers: boolean[][] = [
      [true, true, true, true, true, true, false, false],
      [true, false, false, false, true, false, true, false],
    ];
    for (const [s, pattern] of studentAnswers.entries()) {
      const st = new Client("http://localhost:3000", `10.1.0.${s + 1}`);
      await st.call(session, "POST", "/api/session");
      const joined = await st.call<PlayerDTO>(join, "POST", "/api/classrooms/join", {
        body: { code: created.body.joinCode.toLowerCase(), nickname: `Student ${s + 1}` },
      });
      expect(joined.status).toBe(200);
      expect(joined.body.classroom?.name).toBe("10B Media");
      const round = (await st.call<RoundDTO>(createRoundRoute, "POST", "/api/rounds", { body: { kind: "daily" } })).body;
      const db = await getDb();
      for (const [i, item] of round.items.entries()) {
        const [row] = await db.select({ label: schema.items.label }).from(schema.items).where(eq(schema.items.id, item.id));
        const guess = pattern[i] ? row.label : row.label === "ai" ? "real" : "ai";
        await st.call(answerRoute, "POST", `/api/rounds/${round.id}/answers`, { params: { id: round.id }, body: { itemId: item.id, guess, confidence: 80, responseMs: 500 } });
      }
      await st.call(completeRoute, "POST", `/api/rounds/${round.id}/complete`, { params: { id: round.id } });
    }

    const copycat = new Client("http://localhost:3000", "10.1.0.8");
    await copycat.call(session, "POST", "/api/session");
    expect((await copycat.call(join, "POST", "/api/classrooms/join", { body: { code: created.body.joinCode, nickname: "student 1" } })).status).toBe(409);

    const unknownCode = await new Client("http://localhost:3000", "10.1.0.9");
    await unknownCode.call(session, "POST", "/api/session");
    expect((await unknownCode.call(join, "POST", "/api/classrooms/join", { body: { code: "ZZZZZZ", nickname: "Nobody" } })).status).toBe(404);
    expect((await unknownCode.call(join, "POST", "/api/classrooms/join", { body: { code: "ABC", nickname: "x" } })).status).toBe(400);

    const list = await teacher.call<{ classrooms: ClassroomDTO[] }>(listClasses, "GET", "/api/classrooms");
    expect(list.body.classrooms).toHaveLength(1);
    expect(list.body.classrooms[0].studentCount).toBe(2);

    const dash = await teacher.call<ClassDashboardDTO>(dashboard, "GET", `/api/classrooms/${created.body.id}/dashboard`, { params: { id: created.body.id } });
    expect(dash.status).toBe(200);
    const d = dash.body;
    expect(d.kpis.totalStudents).toBe(2);
    expect(d.kpis.activeStudents).toBe(2);
    expect(d.kpis.accuracy).toBeCloseTo(9 / 16);
    expect(d.kpis.calibrationGap).toBeCloseTo(0.8 - 9 / 16);
    expect(d.kpis.avgStreak).toBe(1);
    expect(d.accuracyByWeek).toHaveLength(8);
    expect(d.accuracyByWeek[7]).toMatchObject({ answered: 16 });
    expect(d.accuracyByWeek[7].accuracy).toBeCloseTo(9 / 16);
    expect(d.accuracyByWeek.slice(0, 7).every((w) => w.answered === 0)).toBe(true);
    expect(d.accuracyByTag.length).toBeGreaterThan(0);
    for (let i = 1; i < d.accuracyByTag.length; i++) expect(d.accuracyByTag[i].accuracy).toBeGreaterThanOrEqual(d.accuracyByTag[i - 1].accuracy);
    expect(d.students.map((s) => [s.nickname, s.answered, s.accuracy])).toEqual([
      ["Student 1", 8, 0.75],
      ["Student 2", 8, 0.375],
    ]);
    expect(d.prePost).toEqual({ pre: null, post: null });

    // another teacher may not look in
    await createStaff("t2@school.org", "teacher-two-pass", "teacher");
    const other = await signIn("t2@school.org", "teacher-two-pass");
    expect((await other.call(dashboard, "GET", "/x", { params: { id: created.body.id } })).status).toBe(403);
    expect((await other.call<{ classrooms: ClassroomDTO[] }>(listClasses, "GET", "/api/classrooms")).body.classrooms).toEqual([]);
    // admins may
    const admin = await signIn("admin@example.com", "admin-password-123");
    expect((await admin.call(dashboard, "GET", "/x", { params: { id: created.body.id } })).status).toBe(200);
    // players and anonymous visitors may not
    expect((await new Client().call(dashboard, "GET", "/x", { params: { id: created.body.id } })).status).toBe(401);
  });
});

describe("audio uploads", () => {
  it("strips metadata from audio with ffmpeg", async () => {
    const { execFileSync } = await import("node:child_process");
    try {
      execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
    } catch {
      return; // ffmpeg not installed here: covered in CI images that have it
    }
    const dir = mkdtempSync(path.join(os.tmpdir(), "rr-audio-"));
    const file = path.join(dir, "voice.mp3");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-metadata", "comment=Generated by VoiceCloneAI", "-metadata", "encoder=CloneEngine 2", file]);
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(file);
    expect(raw.toString("latin1")).toContain("VoiceCloneAI");

    const admin = await signIn("admin@example.com", "admin-password-123");
    const form = new FormData();
    form.set("file", new File([new Uint8Array(raw)], "voice.mp3", { type: "audio/mpeg" }));
    const up = await admin.call<{ url: string; mediaType: string }>(uploadRoute, "POST", "/api/admin/uploads", { raw: form });
    expect(up.status).toBe(201);
    expect(up.body.mediaType).toBe("audio");
    const { readLocalMedia } = await import("@/lib/server/storage");
    const stored = await readLocalMedia(up.body.url.split("/").pop()!);
    expect(stored!.body.toString("latin1")).not.toMatch(/VoiceCloneAI|CloneEngine/);
  });
});

describe("classroom-scale traffic", () => {
  it("lets a whole class behind one school IP join, but stops join-code guessing", async () => {
    const teacher = await signIn("admin@example.com", "admin-password-123");
    const room = (await teacher.call<ClassroomDTO>(createClass, "POST", "/api/classrooms", { body: { name: "Shared IP class" } })).body;
    for (let s = 0; s < 30; s++) {
      const st = new Client("http://localhost:3000", "203.0.113.50");
      await st.call(session, "POST", "/api/session");
      const res = await st.call(join, "POST", "/api/classrooms/join", { body: { code: room.joinCode, nickname: `Pupil ${s}` } });
      expect(res.status).toBe(200);
    }
    const guesser = new Client("http://localhost:3000", "198.51.100.7");
    let last = 0;
    for (let i = 0; i < 41; i++) {
      guesser.cookies.clear();
      await guesser.call(session, "POST", "/api/session");
      last = (await guesser.call(join, "POST", "/api/classrooms/join", { body: { code: `ZZZZ${String(i).padStart(2, "2").replace(/[01]/g, "2")}`, nickname: "Guess" } })).status;
    }
    expect(last).toBe(429);
    // a forged X-Forwarded-For prefix does not escape the limit (the proxy-added last hop is used)
    const spoof = new Client("http://localhost:3000", "1.2.3.4, 198.51.100.7");
    await spoof.call(session, "POST", "/api/session");
    expect((await spoof.call(join, "POST", "/api/classrooms/join", { body: { code: "ZZZZZZ", nickname: "Guess" } })).status).toBe(429);
  });
});

describe("admin content studio", () => {
  it("restricts the studio to admins", async () => {
    await createStaff("t3@school.org", "teacher-three-pass", "teacher");
    const teacher = await signIn("t3@school.org", "teacher-three-pass");
    expect((await teacher.call(stats, "GET", "/api/admin/stats")).status).toBe(403);
    expect((await teacher.call(createItemRoute, "POST", "/api/admin/items", { body: itemFixture(500) })).status).toBe(403);
    expect((await new Client().call(listItemsRoute, "GET", "/api/admin/items")).status).toBe(401);
  });

  it("creates, filters, edits, re-scores and archives items", async () => {
    const admin = await signIn("admin@example.com", "admin-password-123");
    const before = (await admin.call<AdminStatsDTO>(stats, "GET", "/api/admin/stats")).body;

    const created = await admin.call<AdminItemDTO>(createItemRoute, "POST", "/api/admin/items", { body: itemFixture(600, { slug: "studio-new", status: "draft" }) });
    expect(created.status).toBe(201);
    expect(created.body.clues).toHaveLength(2);
    expect((await admin.call(createItemRoute, "POST", "/api/admin/items", { body: itemFixture(601, { slug: "studio-new" }) })).status).toBe(409);
    const badGen = await admin.call<ApiError>(createItemRoute, "POST", "/api/admin/items", { body: itemFixture(602, { slug: "bad-gen", label: "ai", generator: null }) });
    expect(badGen.status).toBe(400);
    const external = await admin.call<ApiError>(createItemRoute, "POST", "/api/admin/items", {
      body: itemFixture(603, { slug: "external", mediaUrl: "https://tracker.example/x.jpg" }),
    });
    expect(external.status).toBe(400);
    const badRegion = await admin.call<ApiError>(createItemRoute, "POST", "/api/admin/items", {
      body: itemFixture(604, { slug: "bad-region", clues: [{ kind: "text", title: "Edge", explanation: "This region spills off the image.", region: { x: 0.9, y: 0.1, w: 0.3, h: 0.1 } }] }),
    });
    expect(badRegion.status).toBe(400);

    const drafts = await admin.call<{ items: AdminItemDTO[] }>(listItemsRoute, "GET", "/api/admin/items?status=draft&q=studio");
    expect(drafts.body.items.map((i) => i.slug)).toEqual(["studio-new"]);

    const id = created.body.id;
    const patched = await admin.call<AdminItemDTO>(patchRoute, "PATCH", `/api/admin/items/${id}`, {
      params: { id },
      body: { status: "published", reviewStatus: "reviewed", clues: [{ kind: "anatomy", title: "Count the fingers", explanation: "The left hand has six fingers.", region: { x: 0.2, y: 0.5, w: 0.2, h: 0.2 } }] },
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({ status: "published", reviewStatus: "reviewed" });
    expect(patched.body.clues.map((c) => c.kind)).toEqual(["anatomy"]);
    // a patch that would break the label/generator rule is refused
    const broken = await admin.call<ApiError>(patchRoute, "PATCH", `/api/admin/items/${id}`, { params: { id }, body: { label: "ai" } });
    expect(broken.status).toBe(400);

    // a player answers it, then the admin corrects the answer key: past answers are re-scored
    const db = await getDb();
    const [p] = await db.insert(schema.players).values({}).returning();
    const [r] = await db.insert(schema.rounds).values({ playerId: p.id, kind: "practice", dayKey: "2026-12-01", itemIds: [id] }).returning();
    await db.insert(schema.answers).values({ roundId: r.id, playerId: p.id, itemId: id, guess: "real", confidence: 90, correct: true, points: 90, responseMs: 1 });
    await db.update(schema.items).set({ timesShown: 1, timesCorrect: 1 }).where(eq(schema.items.id, id));
    const relabelled = await admin.call<AdminItemDTO>(patchRoute, "PATCH", `/api/admin/items/${id}`, {
      params: { id },
      body: { label: "ai", generator: "Midjourney v6" },
    });
    expect(relabelled.status).toBe(200);
    expect(relabelled.body.timesCorrect).toBe(0);
    const [ans] = await db.select().from(schema.answers).where(eq(schema.answers.itemId, id));
    expect(ans).toMatchObject({ correct: false, points: -40 });

    expect((await admin.call(archiveRoute, "DELETE", `/api/admin/items/${id}`, { params: { id } })).status).toBe(200);
    expect((await admin.call<AdminItemDTO>(getItemRoute, "GET", `/x`, { params: { id } })).body.status).toBe("archived");
    expect((await admin.call(getItemRoute, "GET", "/x", { params: { id: "00000000-0000-4000-8000-000000000000" } })).status).toBe(404);

    const after = (await admin.call<AdminStatsDTO>(stats, "GET", "/api/admin/stats")).body;
    expect(after.items.total).toBe(before.items.total + 1);
    expect(after.items.published).toBe(before.items.published);
  });

  it("uploads images, strips metadata, and serves them with byte ranges", async () => {
    const admin = await signIn("admin@example.com", "admin-password-123");
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#8b1040" } })
      .withMetadata({ exif: { IFD0: { Make: "LeakyCam", Model: "Answer Key 3000" } } })
      .jpeg()
      .toBuffer();
    expect((await sharp(png).metadata()).exif).toBeDefined();

    const form = new FormData();
    form.set("file", new File([new Uint8Array(png)], "photo.jpg", { type: "image/jpeg" }));
    const up = await admin.call<{ url: string; mediaType: string; width: number; height: number }>(uploadRoute, "POST", "/api/admin/uploads", { raw: form });
    expect(up.status).toBe(201);
    expect(up.body).toMatchObject({ mediaType: "image", width: 1600, height: 1200 });
    expect(up.body.url).toMatch(/^\/api\/media\/[0-9a-f-]{36}\.jpg$/);

    const key = up.body.url.split("/").pop()!;
    const media = await new Client().call(mediaRoute, "GET", up.body.url, { params: { key } });
    expect(media.status).toBe(200);
    expect(media.headers.get("content-type")).toBe("image/jpeg");
    const ranged = await new Client().call(mediaRoute, "GET", up.body.url, { params: { key }, headers: { range: "bytes=0-99" } });
    expect(ranged.status).toBe(206);
    expect(ranged.headers.get("content-length")).toBe("100");

    // the stored file has no EXIF any more
    const { readLocalMedia } = await import("@/lib/server/storage");
    const stored = await readLocalMedia(key);
    expect((await sharp(stored!.body).metadata()).exif).toBeUndefined();

    // a square "generator-sized" image comes out in the same standard frame
    const square = new FormData();
    square.set("file", new File([new Uint8Array(await sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#ff8a1e" } }).png().toBuffer())], "x.png"));
    const sq = await admin.call<{ width: number; height: number }>(uploadRoute, "POST", "/api/admin/uploads", { raw: square });
    expect(sq.body).toMatchObject({ width: 1600, height: 1200 });

    // fake images and path tricks are refused
    const fake = new FormData();
    fake.set("file", new File([new TextEncoder().encode("<script>alert(1)</script>".repeat(4))], "x.jpg", { type: "image/jpeg" }));
    expect((await admin.call(uploadRoute, "POST", "/api/admin/uploads", { raw: fake })).status).toBe(400);
    expect((await new Client().call(mediaRoute, "GET", "/x", { params: { key: "../../etc/passwd" } })).status).toBe(404);
  });
});

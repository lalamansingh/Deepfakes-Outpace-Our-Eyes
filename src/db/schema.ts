import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  Category,
  ClueKind,
  ItemStatus,
  Label,
  MediaType,
  Region,
  ReviewStatus,
  RoundKind,
  StaffRole,
} from "@/lib/contracts";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
};

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    mediaType: text("media_type").$type<MediaType>().notNull(),
    mediaUrl: text("media_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    label: text("label").$type<Label>().notNull(),
    category: text("category").$type<Category>().notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    license: text("license").notNull(),
    licenseUrl: text("license_url"),
    attribution: text("attribution").notNull(),
    generator: text("generator"),
    provenanceNote: text("provenance_note").notNull(),
    assessmentSet: text("assessment_set").$type<"A" | "B">(),
    status: text("status").$type<ItemStatus>().notNull().default("draft"),
    reviewStatus: text("review_status").$type<ReviewStatus>().notNull().default("ai_draft"),
    /** Elo-style difficulty: higher = harder. */
    rating: real("rating").notNull().default(1500),
    timesShown: integer("times_shown").notNull().default(0),
    timesCorrect: integer("times_correct").notNull().default(0),
    ...timestamps,
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("items_slug_uq").on(t.slug),
    index("items_status_idx").on(t.status),
    check("items_label_ck", sql`${t.label} in ('real', 'ai')`),
    check("items_media_type_ck", sql`${t.mediaType} in ('image', 'audio', 'video')`),
    check("items_status_ck", sql`${t.status} in ('draft', 'published', 'archived')`),
    check("items_review_ck", sql`${t.reviewStatus} in ('ai_draft', 'reviewed')`),
    check("items_assessment_ck", sql`${t.assessmentSet} is null or ${t.assessmentSet} in ('A', 'B')`),
    check("items_generator_ck", sql`(${t.label} = 'ai') = (${t.generator} is not null)`),
  ],
);

export const clues = pgTable(
  "clues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").$type<ClueKind>().notNull(),
    title: text("title").notNull(),
    explanation: text("explanation").notNull(),
    region: jsonb("region").$type<Region | null>(),
  },
  (t) => [index("clues_item_idx").on(t.itemId)],
);

export const staffUsers = pgTable(
  "staff_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    role: text("role").$type<StaffRole>().notNull().default("teacher"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("staff_users_email_uq").on(t.email),
    check("staff_users_role_ck", sql`${t.role} in ('teacher', 'admin')`),
  ],
);

export const classrooms = pgTable(
  "classrooms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => staffUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    joinCode: text("join_code").notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex("classrooms_join_code_uq").on(t.joinCode), index("classrooms_teacher_idx").on(t.teacherId)],
);

export const players = pgTable(
  "players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nickname: text("nickname"),
    classroomId: uuid("classroom_id").references(() => classrooms.id, { onDelete: "set null" }),
    streak: integer("streak").notNull().default(0),
    bestStreak: integer("best_streak").notNull().default(0),
    /** UTC day (YYYY-MM-DD) of the last completed daily round. */
    lastDailyDay: text("last_daily_day"),
    ...timestamps,
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("players_classroom_idx").on(t.classroomId),
    // Nicknames are unique inside a class (case-insensitive) so teachers can tell students apart.
    uniqueIndex("players_class_nickname_uq").on(t.classroomId, sql`lower(${t.nickname})`),
  ],
);

/** Per-player skill rating for each clue kind (the adaptive engine's player model). */
export const playerSkills = pgTable(
  "player_skills",
  {
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    tag: text("tag").$type<ClueKind>().notNull(),
    rating: real("rating").notNull().default(1500),
    answered: integer("answered").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.playerId, t.tag] })],
);

export const rounds = pgTable(
  "rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RoundKind>().notNull(),
    dayKey: text("day_key").notNull(),
    itemIds: jsonb("item_ids").$type<string[]>().notNull(),
    score: integer("score"),
    ...timestamps,
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    index("rounds_player_idx").on(t.playerId, t.createdAt),
    // One daily round per player per day, one of each assessment per player.
    uniqueIndex("rounds_daily_uq").on(t.playerId, t.dayKey).where(sql`${t.kind} = 'daily'`),
    uniqueIndex("rounds_assessment_uq").on(t.playerId, t.kind).where(sql`${t.kind} like 'assessment%'`),
    check("rounds_kind_ck", sql`${t.kind} in ('daily', 'practice', 'assessment_pre', 'assessment_post')`),
  ],
);

export const answers = pgTable(
  "answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    roundId: uuid("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: uuid("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "restrict" }),
    guess: text("guess").$type<Label>().notNull(),
    confidence: integer("confidence").notNull(),
    correct: boolean("correct").notNull(),
    points: integer("points").notNull(),
    responseMs: integer("response_ms").notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("answers_round_item_uq").on(t.roundId, t.itemId),
    index("answers_player_idx").on(t.playerId, t.createdAt),
    index("answers_item_idx").on(t.itemId),
    check("answers_guess_ck", sql`${t.guess} in ('real', 'ai')`),
    check("answers_confidence_ck", sql`${t.confidence} between 50 and 100`),
  ],
);

/**
 * Shared API contracts: the single source of truth for request validation (zod)
 * and response shapes (TypeScript types) used by both the API routes and the UI.
 */
import { z } from "zod";

// ---------------------------------------------------------------- enums

export const LABELS = ["real", "ai"] as const;
export type Label = (typeof LABELS)[number];

export const MEDIA_TYPES = ["image", "audio", "video"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const CATEGORIES = ["portrait", "animal", "landscape", "food", "architecture", "object", "scene", "voice"] as const;
export type Category = (typeof CATEGORIES)[number];

/** What a clue points at. Also the "skill tags" the adaptive engine tracks per player. */
export const CLUE_KINDS = [
  "lighting", // shadows, reflections, light direction
  "anatomy", // hands, teeth, ears, eyes, limbs
  "texture", // over-smooth skin, plastic look, repeating patterns
  "text", // garbled letters, signs, logos
  "geometry", // warped lines, impossible structures, perspective
  "background", // melting or inconsistent background details
  "source", // who published it, can it be traced
  "context", // does the story make sense, emotional bait
  "audio", // breathing, prosody, artefacts
  "lipsync", // mouth vs. sound alignment
  "metadata", // camera data, content credentials (C2PA)
] as const;
export type ClueKind = (typeof CLUE_KINDS)[number];

export const ROUND_KINDS = ["daily", "practice", "assessment_pre", "assessment_post"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];

export const ITEM_STATUSES = ["draft", "published", "archived"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const REVIEW_STATUSES = ["ai_draft", "reviewed"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const STAFF_ROLES = ["teacher", "admin"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const ROUND_SIZE = 8;
export const CONFIDENCE_MIN = 50;
export const CONFIDENCE_MAX = 100;

// ---------------------------------------------------------------- shared pieces

/** Region on the media, all values are fractions of width/height in [0, 1]. */
export const regionSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().gt(0).max(1),
    h: z.number().gt(0).max(1),
  })
  .refine((r) => r.x + r.w <= 1.0001 && r.y + r.h <= 1.0001, { message: "region must stay inside the media" });
export type Region = z.infer<typeof regionSchema>;

export const clueInputSchema = z.object({
  kind: z.enum(CLUE_KINDS),
  title: z.string().trim().min(2).max(80),
  explanation: z.string().trim().min(10).max(400),
  region: regionSchema.nullable(),
});
export type ClueInput = z.infer<typeof clueInputSchema>;

export type ClueDTO = ClueInput & { id: string };

export type SourceDTO = {
  name: string;
  url: string;
  license: string;
  licenseUrl: string | null;
  attribution: string;
  generator: string | null;
};

// ---------------------------------------------------------------- player

export type PlayerStatsDTO = {
  answered: number;
  correct: number;
  accuracy: number; // 0..1, 0 when nothing answered
  avgConfidence: number; // 0..1
  calibrationGap: number; // avgConfidence - accuracy; > 0 means overconfident
  brier: number | null; // mean Brier score, lower is better, null when nothing answered
  streak: number;
  bestStreak: number;
  playedToday: boolean;
  skills: { tag: ClueKind; rating: number; answered: number }[];
};

export type PlayerDTO = {
  id: string;
  nickname: string | null;
  classroom: { id: string; name: string } | null;
  stats: PlayerStatsDTO;
};

export const createRoundSchema = z.object({ kind: z.enum(ROUND_KINDS).default("daily") });

/** An item as shown during play: never includes the label or clues. */
export type PlayItemDTO = {
  id: string;
  mediaType: MediaType;
  mediaUrl: string;
  width: number | null;
  height: number | null;
  category: Category;
};

export type RoundDTO = {
  id: string;
  kind: RoundKind;
  dayKey: string; // YYYY-MM-DD (UTC)
  items: PlayItemDTO[];
  answers: AnswerResultDTO[]; // already answered items, in order
  completedAt: string | null;
};

export const answerSchema = z.object({
  itemId: z.string().uuid(),
  guess: z.enum(LABELS),
  confidence: z.number().int().min(CONFIDENCE_MIN).max(CONFIDENCE_MAX),
  responseMs: z.number().int().min(0).max(30 * 60 * 1000),
});
export type AnswerInput = z.infer<typeof answerSchema>;

export type AnswerResultDTO = {
  itemId: string;
  guess: Label;
  confidence: number;
  correct: boolean;
  label: Label;
  points: number;
  clues: ClueDTO[];
  source: SourceDTO;
  progress: { answered: number; total: number };
};

export type RoundSummaryDTO = {
  roundId: string;
  kind: RoundKind;
  score: number;
  maxScore: number;
  correct: number;
  total: number;
  accuracy: number;
  avgConfidence: number;
  calibrationGap: number;
  brier: number;
  /** Feedback the UI can show verbatim, e.g. "You were overconfident on AI images". */
  insight: string;
  weakestTags: ClueKind[];
  streak: number;
  bestStreak: number;
};

export const joinClassroomSchema = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/, "join codes have 6 letters or digits"),
  nickname: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[\p{L}\p{N} _.-]+$/u, "letters, numbers, spaces, _ . - only"),
});

// ---------------------------------------------------------------- staff auth

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(10).max(200),
  name: z.string().trim().min(2).max(80),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export type StaffDTO = { id: string; email: string; name: string; role: StaffRole };

// ---------------------------------------------------------------- teacher

export const createClassroomSchema = z.object({ name: z.string().trim().min(2).max(80) });

export type ClassroomDTO = { id: string; name: string; joinCode: string; studentCount: number; createdAt: string };

export type ClassDashboardDTO = {
  classroom: ClassroomDTO;
  kpis: {
    activeStudents: number; // answered at least once in the last 7 days
    totalStudents: number;
    accuracy: number;
    calibrationGap: number;
    avgStreak: number;
  };
  accuracyByWeek: { weekStart: string; answered: number; accuracy: number }[]; // last 8 ISO weeks, oldest first
  accuracyByTag: { tag: ClueKind; answered: number; accuracy: number }[]; // lowest accuracy first
  prePost: { pre: { students: number; accuracy: number } | null; post: { students: number; accuracy: number } | null };
  students: {
    id: string;
    nickname: string;
    answered: number;
    accuracy: number;
    calibrationGap: number;
    streak: number;
    lastActive: string | null;
  }[];
};

// ---------------------------------------------------------------- admin content studio

export const itemInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[a-z0-9-]+$/, "lowercase letters, digits and dashes"),
  mediaType: z.enum(MEDIA_TYPES),
  mediaUrl: z.string().trim().min(1).max(500),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  label: z.enum(LABELS),
  category: z.enum(CATEGORIES),
  sourceName: z.string().trim().min(2).max(120),
  sourceUrl: z.string().trim().url().max(500),
  license: z.string().trim().min(2).max(80),
  licenseUrl: z.string().trim().url().max(300).nullable(),
  attribution: z.string().trim().min(1).max(300),
  generator: z.string().trim().max(120).nullable(),
  provenanceNote: z.string().trim().min(10).max(600),
  assessmentSet: z.enum(["A", "B"]).nullable(),
  status: z.enum(ITEM_STATUSES),
  reviewStatus: z.enum(REVIEW_STATUSES),
  clues: z.array(clueInputSchema).min(1).max(8),
});
export type ItemInput = z.infer<typeof itemInputSchema>;
export const itemPatchSchema = itemInputSchema.partial();

export type AdminItemDTO = Omit<ItemInput, "clues"> & {
  id: string;
  rating: number;
  timesShown: number;
  timesCorrect: number;
  createdAt: string;
  updatedAt: string;
  clues: ClueDTO[];
};

export type AdminStatsDTO = {
  items: { total: number; published: number; real: number; ai: number; needsReview: number };
  players: number;
  answers: number;
  classrooms: number;
};

// ---------------------------------------------------------------- errors

export type ApiError = { error: { code: string; message: string; details?: unknown } };

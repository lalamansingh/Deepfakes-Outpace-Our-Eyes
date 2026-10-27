import type { Category, ItemStatus, ReviewStatus } from "@/lib/contracts";

/** Clue-kind names live in one place, shared with the player app. */
export { CLUE_KIND_LABELS } from "@/components/player/labels";

export const CATEGORY_LABELS: Record<Category, string> = {
  portrait: "Portrait",
  animal: "Animal",
  landscape: "Landscape",
  food: "Food",
  architecture: "Architecture",
  object: "Object",
  scene: "Scene",
  voice: "Voice",
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  ai_draft: "Needs review",
  reviewed: "Reviewed",
};

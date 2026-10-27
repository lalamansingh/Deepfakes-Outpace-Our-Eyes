/** Human-readable copy shared by the player app (and importable by the staff UI). */
import type { ClueKind, Label } from "@/lib/contracts";

export const CLUE_KIND_LABELS: Record<ClueKind, string> = {
  lighting: "Lighting & shadows",
  anatomy: "Hands, faces & bodies",
  texture: "Texture & skin",
  text: "Text & signs",
  geometry: "Lines & perspective",
  background: "Background details",
  source: "Source checking",
  context: "Context & emotional bait",
  audio: "Voice & audio",
  lipsync: "Lip-sync",
  metadata: "Metadata & credentials",
};

export const LABEL_NAMES: Record<Label, string> = {
  real: "Real",
  ai: "Rendered (AI-made)",
};

/** "+80", "−20", "±0" — uses a true minus sign for readability. */
export function formatPoints(points: number) {
  if (points > 0) return `+${points}`;
  if (points < 0) return `−${Math.abs(points)}`;
  return "±0";
}

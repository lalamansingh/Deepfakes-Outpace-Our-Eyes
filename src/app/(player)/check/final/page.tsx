import type { Metadata } from "next";
import { Game } from "@/components/player/game";

export const metadata: Metadata = {
  title: "Final check",
  description: "An 8-item check with new items that measures how much your eye has improved.",
};

export default function FinalCheckPage() {
  return <Game kind="assessment_post" />;
}

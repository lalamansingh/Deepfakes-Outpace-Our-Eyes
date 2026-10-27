import type { Metadata } from "next";
import { Game } from "@/components/player/game";

export const metadata: Metadata = {
  title: "Practice",
  description: "Unlimited practice rounds to train your eye for AI-generated media.",
};

export default function PracticePage() {
  return <Game kind="practice" />;
}

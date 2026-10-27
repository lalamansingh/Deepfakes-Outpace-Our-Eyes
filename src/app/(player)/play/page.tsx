import type { Metadata } from "next";
import { Game } from "@/components/player/game";

export const metadata: Metadata = {
  title: "Today's challenge",
  description: "Eight images, voices and videos. Real or rendered? Five minutes to sharpen your eye.",
};

export default function PlayPage() {
  return <Game kind="daily" />;
}

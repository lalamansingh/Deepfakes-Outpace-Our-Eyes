import type { Metadata } from "next";
import { Game } from "@/components/player/game";

export const metadata: Metadata = {
  title: "Starting check",
  description: "An 8-item check that measures where you start, so you and your teacher can see how much you improve.",
};

export default function StartingCheckPage() {
  return <Game kind="assessment_pre" />;
}

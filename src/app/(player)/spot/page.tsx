import type { Metadata } from "next";
import { SpotGame } from "@/components/player/spot-game";

export const metadata: Metadata = {
  title: "Spot the fake",
  description: "Four images, one odd one out. Find the AI-made image among real photos, or the real photo among AI fakes.",
};

export default function SpotPage() {
  return <SpotGame />;
}

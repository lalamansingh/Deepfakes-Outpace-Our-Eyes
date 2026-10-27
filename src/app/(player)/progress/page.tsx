import type { Metadata } from "next";
import { PageShell } from "@/components/player/page-shell";
import { ProgressView } from "@/components/player/progress-view";

export const metadata: Metadata = { title: "Your progress" };

export default function ProgressPage() {
  return (
    <PageShell
      eyebrow="Your progress"
      title="How sharp is your eye?"
      intro="Accuracy tells you how often you're right. Calibration tells you whether your confidence deserves to be trusted. Both matter."
      width="max-w-5xl"
    >
      <ProgressView />
    </PageShell>
  );
}

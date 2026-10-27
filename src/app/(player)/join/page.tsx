import { EyeOff, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { JoinForm } from "@/components/player/join-form";
import { PageShell } from "@/components/player/page-shell";

export const metadata: Metadata = { title: "Join a class" };

export default function JoinPage() {
  return (
    <PageShell
      eyebrow="Join a class"
      title="Play with your class"
      intro="Enter the code your teacher shared and pick a nickname. You keep playing exactly as before; your teacher sees how the class is improving."
    >
      <div className="grid gap-8 md:grid-cols-[1fr_280px]">
        <JoinForm />
        <aside aria-labelledby="privacy-heading" className="flex flex-col gap-4 text-sm text-muted">
          <h2 id="privacy-heading" className="flex items-center gap-2 font-semibold text-ink">
            <ShieldCheck className="size-5 text-wine" aria-hidden /> What your teacher sees
          </h2>
          <p>
            Only your <strong className="text-ink">nickname</strong> and your game results: items answered, accuracy, confidence and streak.
          </p>
          <p className="flex gap-2">
            <EyeOff className="mt-0.5 size-4 shrink-0 text-wine" aria-hidden />
            No email, no real name, no account. Your progress is linked to an anonymous cookie on this device.
          </p>
        </aside>
      </div>
    </PageShell>
  );
}

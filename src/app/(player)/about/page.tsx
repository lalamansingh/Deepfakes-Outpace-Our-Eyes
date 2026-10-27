import { BadgeCheck, Cookie, GraduationCap, Mail, Scale } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ButtonLink, Card } from "@/components/ui";
import { PageShell } from "@/components/player/page-shell";

export const metadata: Metadata = { title: "About" };

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-line py-8 first:border-t-0 first:pt-0 sm:grid-cols-[200px_1fr] sm:gap-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-tint text-wine">{icon}</span>
        {title}
      </h2>
      <div className="flex flex-col gap-3 leading-relaxed text-muted">{children}</div>
    </section>
  );
}

export default function AboutPage() {
  return (
    <PageShell
      eyebrow="About"
      title="Why Real or Rendered?"
      intro="AI can now produce photos, voices and videos that fool most people. We built a tiny daily habit that trains the eye and, just as importantly, an honest sense of how much to trust it."
    >
      <Section icon={<GraduationCap className="size-5" aria-hidden />} title="The project">
        <p>
          Real or Rendered? is our entry to the <strong className="text-ink">Sopra Steria International Student Challenge 2026–2027</strong>,
          cognitive stream. It is built for students aged 13–25, and works just as well for teachers, parents and grandparents.
        </p>
        <p>Eight items a day, about five minutes. Each answer comes with the clues you might have missed and the original source.</p>
      </Section>

      <Section icon={<Scale className="size-5" aria-hidden />} title="How scoring works">
        <p>For every item you pick Real or Rendered and say how sure you are, from 50% (just guessing) to 100% (certain).</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Card tone="ora" className="h-full">
              <p className="font-semibold text-ink">Right answer</p>
              <p className="mt-1 text-sm">
                You earn your confidence: <strong className="text-ink">+50 to +100</strong> points.
              </p>
            </Card>
          </li>
          <li>
            <Card tone="tint" className="h-full">
              <p className="font-semibold text-ink">Wrong answer</p>
              <p className="mt-1 text-sm">
                You lose <strong className="text-ink">confidence − 50</strong>: from 0 (if you said 50%) to −50 (if you said 100%).
              </p>
            </Card>
          </li>
        </ul>
        <p>So bluffing doesn&apos;t pay. Being honest about uncertainty does. That&apos;s the skill that protects you online.</p>
      </Section>

      <Section icon={<BadgeCheck className="size-5" aria-hidden />} title="How labels are verified">
        <p>
          Real items are photos and recordings with a documented origin, mostly from Wikimedia Commons, where authorship and licence are
          recorded. Rendered items are AI-generated works whose publisher documents the generator that made them.
        </p>
        <p>
          Each label rests on that documented provenance, and our team reviews the clues for every item. Clue boxes mark where to look; they are hints, not proof. Each
          reveal links to the original source so you can check it yourself.
        </p>
      </Section>

      <Section icon={<Cookie className="size-5" aria-hidden />} title="Privacy">
        <ul className="list-disc space-y-1 pl-5">
          <li>No account, no email, no real name.</li>
          <li>One anonymous cookie keeps your progress on this device.</li>
          <li>No ads, no third-party tracking, no analytics scripts.</li>
          <li>If you join a class, your teacher sees only your chosen nickname and game results.</li>
        </ul>
      </Section>

      <Section icon={<Mail className="size-5" aria-hidden />} title="Contact">
        <p>
          Questions, corrections or a mislabelled item? Write to{" "}
          <span className="font-medium text-ink">team@real-or-rendered.example</span>.
        </p>
        <div>
          <ButtonLink href="/play">Play today&apos;s challenge</ButtonLink>
        </div>
      </Section>
    </PageShell>
  );
}

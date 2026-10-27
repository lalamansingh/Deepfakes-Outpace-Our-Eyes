import clsx from "clsx";
import { BarChart3, CalendarCheck, Dumbbell, Flame, Sparkles, Target } from "lucide-react";
import type { ReactNode } from "react";
import type { RoundSummaryDTO } from "@/lib/contracts";
import { Button, ButtonLink, percent } from "@/components/ui";
import { CLUE_KIND_LABELS } from "./labels";

function Meter({ label, value, tone, caption }: { label: string; value: number; tone: "ora" | "wine"; caption: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span className="font-semibold text-white">{label}</span>
        <span className="font-bold text-white">{percent(value)}</span>
      </div>
      <div
        className="h-3 overflow-hidden rounded-full bg-white/10"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
      >
        <div
          className={clsx("h-full rounded-full", tone === "ora" ? "bg-gradient-ora" : "bg-gradient-wine")}
          style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-white/55">{caption}</p>
    </div>
  );
}

function Tile({ icon, value, label }: { icon: ReactNode; value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-ora">{icon}</div>
      <div className="mt-2 text-2xl font-bold leading-none text-white">{value}</div>
      <div className="mt-1 text-xs text-white/60">{label}</div>
    </div>
  );
}

function calibrationNote(gap: number) {
  const pts = Math.round(Math.abs(gap) * 100);
  if (pts <= 3) return "Your confidence matched your accuracy: well calibrated.";
  return gap > 0 ? `Gap: ${pts} points more sure than right.` : `Gap: ${pts} points more right than sure.`;
}

export function RoundSummary({
  summary,
  alreadyDone,
  onPracticeAgain,
}: {
  summary: RoundSummaryDTO;
  /** The daily round was finished earlier today (page reload / revisit). */
  alreadyDone: boolean;
  /** Present in practice mode: starts a fresh practice round in place. */
  onPracticeAgain?: () => void;
}) {
  const isDaily = summary.kind === "daily";
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-ora">
          {isDaily
            ? alreadyDone
              ? "Today's challenge · done"
              : "Daily challenge complete"
            : summary.kind === "assessment_pre"
              ? "Starting check complete"
              : summary.kind === "assessment_post"
                ? "Final check complete"
                : "Practice round complete"}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {alreadyDone ? "Come back tomorrow" : summary.correct >= summary.total * 0.75 ? "Sharp eyes!" : "Round complete"}
        </h1>
        <p className="mt-2 text-white/70">
          {alreadyDone
            ? "You've already played today's challenge. A fresh set unlocks at midnight UTC. Here's how you did."
            : `You spotted ${summary.correct} of ${summary.total} correctly.`}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-[1.1fr_1fr]">
        <div className="rounded-[var(--radius-card)] border border-white/10 bg-plum-2/80 p-6">
          <p className="text-sm text-white/65">Score</p>
          <p className="mt-1 text-5xl font-extrabold leading-none text-white">
            {summary.score}
            <span className="text-xl font-semibold text-white/50"> / {summary.maxScore}</span>
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <Meter label="How sure" value={summary.avgConfidence} tone="ora" caption="Your average confidence" />
            <Meter label="How right" value={summary.accuracy} tone="wine" caption="Your actual accuracy" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-white/80">{calibrationNote(summary.calibrationGap)}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 self-start">
          <Tile icon={<Target className="size-5" aria-hidden />} value={percent(summary.accuracy)} label="Accuracy" />
          <Tile icon={<Flame className="size-5" aria-hidden />} value={summary.streak} label={summary.streak === 1 ? "Day streak" : "Days streak"} />
          <Tile icon={<Sparkles className="size-5" aria-hidden />} value={summary.bestStreak} label="Best streak" />
          <Tile icon={<CalendarCheck className="size-5" aria-hidden />} value={`${summary.correct}/${summary.total}`} label="Correct" />
        </div>
      </div>

      <div className="mt-4 rounded-[var(--radius-card)] bg-gradient-wine p-6 text-white">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-ora-light">
          <Sparkles className="size-4" aria-hidden /> Insight
        </p>
        <p className="mt-2 text-lg font-semibold leading-snug">{summary.insight}</p>
        {summary.weakestTags.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-white/75">Clues to practise next:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {summary.weakestTags.map((tag) => (
                <li key={tag} className="rounded-full bg-white/12 px-3 py-1 text-sm font-medium">
                  {CLUE_KIND_LABELS[tag]}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        {onPracticeAgain ? (
          <Button onClick={onPracticeAgain} className="py-4">
            <Dumbbell className="size-4" aria-hidden /> Practice more
          </Button>
        ) : (
          <ButtonLink href="/practice" className="py-4">
            <Dumbbell className="size-4" aria-hidden /> Practice more
          </ButtonLink>
        )}
        <ButtonLink href="/progress" variant="dark" className="py-4">
          <BarChart3 className="size-4" aria-hidden /> See your progress
        </ButtonLink>
      </div>
    </div>
  );
}

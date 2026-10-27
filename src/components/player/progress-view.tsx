"use client";

import Link from "next/link";
import clsx from "clsx";
import { BarChart3, Flame, Gauge, Play, Scale, Target, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import type { PlayerDTO } from "@/lib/contracts";
import { ButtonLink, Card, Spinner, percent } from "@/components/ui";
import { friendlyError } from "./errors";
import { CLUE_KIND_LABELS } from "./labels";
import { RetryError } from "./retry-error";

/** Skill ratings are Elo-style around 1500: show them as the chance of beating an average-difficulty item. */
const AVERAGE_ITEM_RATING = 1500;
const skillChance = (rating: number) => 1 / (1 + 10 ** ((AVERAGE_ITEM_RATING - rating) / 400));

function skillLevel(chance: number) {
  if (chance < 0.4) return "Needs work";
  if (chance < 0.55) return "Developing";
  if (chance < 0.7) return "Solid";
  return "Strong";
}

function calibrationWords(gap: number) {
  const pts = Math.round(Math.abs(gap) * 100);
  if (pts <= 3) return { headline: "Well calibrated", detail: "Your confidence matches how often you are right. Keep it up." };
  return gap > 0
    ? {
        headline: `You are ${pts} points overconfident`,
        detail: "On average you feel surer than your results justify. Lower your confidence when you can't name a clue.",
      }
    : {
        headline: `You are ${pts} points underconfident`,
        detail: "You are right more often than you think. When you spot a clue, back yourself.",
      };
}

function StatCard({ icon, value, label, children }: { icon: ReactNode; value: ReactNode; label: string; children?: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-tint text-wine">{icon}</span>
      <p className="text-3xl font-bold leading-none text-ink">{value}</p>
      <p className="text-sm font-medium text-muted">{label}</p>
      {children}
    </Card>
  );
}

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; player: PlayerDTO | null };

export function ProgressView() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      setState({ status: "ready", player: await api.get<PlayerDTO>("/api/me") });
    } catch (err) {
      // No session yet simply means a brand-new player.
      if (err instanceof ApiClientError && err.status === 401) setState({ status: "ready", player: null });
      else setState({ status: "error", message: friendlyError(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") return <Spinner label="Loading your progress" />;
  if (state.status === "error") return <RetryError message={state.message} onRetry={() => void load()} />;

  const stats = state.player?.stats;
  if (!stats || stats.answered === 0) {
    return (
      <Card tone="tint" className="flex flex-col items-start gap-4 p-8">
        <span className="grid size-12 place-items-center rounded-2xl bg-gradient-wine text-white">
          <BarChart3 className="size-6" aria-hidden />
        </span>
        <h2 className="text-xl font-bold text-ink">No answers yet</h2>
        <p className="max-w-prose text-muted">
          Play your first daily challenge and this page will show your accuracy, how well your confidence matches reality, and which
          kinds of clues you spot best.
        </p>
        <ButtonLink href="/play">
          <Play className="size-4" aria-hidden /> Play today&apos;s challenge
        </ButtonLink>
      </Card>
    );
  }

  const calib = calibrationWords(stats.calibrationGap);
  const skills = [...stats.skills].sort((a, b) => b.rating - a.rating);

  return (
    <div className="flex flex-col gap-8">
      {state.player?.classroom && (
        <p className="text-sm text-muted">
          Playing as <strong className="text-ink">{state.player.nickname}</strong> in{" "}
          <strong className="text-ink">{state.player.classroom.name}</strong>
          {" · "}Class checks:{" "}
          <Link href="/check/start" className="font-semibold text-wine underline underline-offset-2">
            starting check
          </Link>
          {" / "}
          <Link href="/check/final" className="font-semibold text-wine underline underline-offset-2">
            final check
          </Link>
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={<Target className="size-5" aria-hidden />} value={stats.answered} label="Items answered" />
        <StatCard icon={<Gauge className="size-5" aria-hidden />} value={percent(stats.accuracy)} label={`Accuracy (${stats.correct} right)`} />
        <StatCard icon={<Flame className="size-5" aria-hidden />} value={stats.streak} label={stats.playedToday ? "Day streak · played today" : "Day streak"} />
        <StatCard icon={<Trophy className="size-5" aria-hidden />} value={stats.bestStreak} label="Best streak" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-wine">
            <Scale className="size-4" aria-hidden /> Calibration
          </h2>
          <p className="mt-3 text-2xl font-bold text-ink">{calib.headline}</p>
          <p className="mt-2 text-muted">{calib.detail}</p>
          <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-line pt-4 text-sm">
            <div>
              <dt className="text-muted">How sure (avg. confidence)</dt>
              <dd className="text-lg font-bold text-ora-deep">{percent(stats.avgConfidence)}</dd>
            </div>
            <div>
              <dt className="text-muted">How right (accuracy)</dt>
              <dd className="text-lg font-bold text-wine">{percent(stats.accuracy)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.12em] text-wine">
            <Gauge className="size-4" aria-hidden /> Brier score
          </h2>
          <p className="mt-3 text-4xl font-bold text-ink">{stats.brier === null ? "–" : stats.brier.toFixed(2)}</p>
          <p className="mt-2 text-muted">
            Measures how close your confidence is to reality: 0 is perfect, 0.25 is what pure coin-flip guessing scores. Lower is better.
          </p>
        </Card>
      </div>

      <section aria-labelledby="skills-heading">
        <h2 id="skills-heading" className="text-xl font-bold text-ink">
          Your clue skills
        </h2>
        <p className="mt-1 text-sm text-muted">Estimated chance that you catch an average-difficulty item relying on each kind of clue.</p>
        {skills.length === 0 ? (
          <p className="mt-4 text-muted">Skills appear after a few more answers.</p>
        ) : (
          <ul className="mt-5 grid gap-x-8 gap-y-4 md:grid-cols-2">
            {skills.map((s) => {
              const chance = skillChance(s.rating);
              return (
                <li key={s.tag}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="font-semibold text-ink">{CLUE_KIND_LABELS[s.tag]}</span>
                    <span className="shrink-0 text-muted">
                      {skillLevel(chance)} · {percent(chance)}
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-tint"
                    role="meter"
                    aria-label={CLUE_KIND_LABELS[s.tag]}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(chance * 100)}
                    aria-valuetext={`${skillLevel(chance)}, ${percent(chance)}`}
                  >
                    <div
                      className={clsx("h-full rounded-full", chance >= 0.55 ? "bg-gradient-wine" : "bg-gradient-ora")}
                      style={{ width: `${Math.max(3, chance * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-subtle">
                    {s.answered} {s.answered === 1 ? "answer" : "answers"}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Card tone="ora" className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <p className="font-semibold text-ink">
          {stats.playedToday ? "Daily done. Keep the momentum with a practice round." : "Today's challenge is waiting. Keep your streak alive."}
        </p>
        <ButtonLink href={stats.playedToday ? "/practice" : "/play"}>
          <Play className="size-4" aria-hidden /> {stats.playedToday ? "Practice" : "Play today's challenge"}
        </ButtonLink>
      </Card>
    </div>
  );
}

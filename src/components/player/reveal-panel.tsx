"use client";

import clsx from "clsx";
import { ArrowRight, Check, ExternalLink, Lightbulb, X } from "lucide-react";
import { forwardRef } from "react";
import type { AnswerResultDTO } from "@/lib/contracts";
import { Button } from "@/components/ui";
import { CLUE_KIND_LABELS, formatPoints, LABEL_NAMES } from "./labels";

type Props = {
  result: AnswerResultDTO;
  activeClueId: string | null;
  onSelectClue: (id: string | null) => void;
  onNext: () => void;
  isLast: boolean;
  busy: boolean;
};

export const RevealPanel = forwardRef<HTMLHeadingElement, Props>(function RevealPanel(
  { result, activeClueId, onSelectClue, onNext, isLast, busy },
  headingRef,
) {
  const { correct, label, points, clues, source } = result;
  const Icon = correct ? Check : X;
  return (
    <section aria-labelledby="reveal-heading" className="flex flex-col gap-5">
      <div
        className={clsx(
          "flex items-start gap-4 rounded-2xl p-4",
          correct ? "bg-gradient-ora text-white" : "border border-white/15 bg-white/6 text-white",
        )}
      >
        <span
          className={clsx("grid size-11 shrink-0 place-items-center rounded-full", correct ? "bg-white text-ora-deep" : "bg-wine text-white")}
        >
          <Icon className="size-6" strokeWidth={3} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="reveal-heading" ref={headingRef} tabIndex={-1} className="text-xl font-bold leading-tight outline-none">
            {correct ? "Correct!" : "Not this time"}
          </h2>
          <p className={clsx("text-sm", correct ? "text-white/90" : "text-white/75")}>
            It was <strong className="font-semibold text-white">{LABEL_NAMES[label]}</strong>. You said {result.confidence}% sure.
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="block text-2xl font-extrabold leading-none">{formatPoints(points)}</span>
          <span className={clsx("text-xs", correct ? "text-white/85" : "text-white/60")}>points</span>
        </p>
      </div>

      {clues.length > 0 && (
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white/85">
            <Lightbulb className="size-4 text-ora" aria-hidden />
            {label === "ai" ? "Clues it was rendered" : "Why it holds up as real"}
          </h3>
          <ol className="flex flex-col gap-2">
            {clues.map((clue, i) => {
              const active = activeClueId === clue.id;
              const body = (
                <>
                  <span
                    className={clsx(
                      "grid size-6 shrink-0 place-items-center rounded-md text-xs font-bold",
                      active ? "bg-ora text-plum" : "bg-white text-plum",
                    )}
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">{clue.title}</span>
                    <span className="mt-0.5 block text-xs font-medium uppercase tracking-wide text-ora-light">
                      {CLUE_KIND_LABELS[clue.kind]}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-white/75">{clue.explanation}</span>
                  </span>
                </>
              );
              return (
                <li key={clue.id}>
                  {clue.region ? (
                    <button
                      type="button"
                      aria-pressed={active}
                      onClick={() => onSelectClue(active ? null : clue.id)}
                      className={clsx(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition",
                        active ? "border-ora bg-ora/10" : "border-white/10 bg-white/5 hover:border-white/30",
                      )}
                    >
                      {body}
                      <span className="sr-only">{active ? "(highlighted on the image)" : "(show on the image)"}</span>
                    </button>
                  ) : (
                    <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <p className="text-xs leading-relaxed text-white/60">
        Source:{" "}
        <a href={source.url} target="_blank" rel="noopener noreferrer" className="font-medium text-white/85 underline underline-offset-2 hover:text-ora">
          {source.name}
          <ExternalLink className="ml-1 inline size-3" aria-hidden />
          <span className="sr-only"> (opens in a new tab)</span>
        </a>{" "}
        · {source.attribution} ·{" "}
        {source.licenseUrl ? (
          <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-ora">
            {source.license}
          </a>
        ) : (
          source.license
        )}
        {source.generator ? <> · Generated with {source.generator}</> : null}
      </p>

      <Button onClick={onNext} disabled={busy} className="w-full py-4 text-base" aria-keyshortcuts="N">
        {busy ? "Scoring your round…" : isLast ? "See your results" : "Next item"}
        <ArrowRight className="size-4" aria-hidden />
      </Button>
    </section>
  );
});

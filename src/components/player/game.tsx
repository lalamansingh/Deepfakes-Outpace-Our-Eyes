"use client";

import { Keyboard } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import type { AnswerInput, AnswerResultDTO, Label, RoundDTO, RoundKind, RoundSummaryDTO } from "@/lib/contracts";
import { CONFIDENCE_MAX, CONFIDENCE_MIN } from "@/lib/contracts";
import { ErrorNote } from "@/components/ui";
import { AnswerControls } from "./answer-controls";
import { friendlyError } from "./errors";
import { LABEL_NAMES, formatPoints } from "./labels";
import { MediaView } from "./media-view";
import { ProgressDots } from "./progress-dots";
import { RetryError } from "./retry-error";
import { RevealPanel } from "./reveal-panel";
import { RoundSummary } from "./round-summary";

type GameKind = RoundKind;

const KIND_COPY: Record<GameKind, { name: string; loading: string }> = {
  daily: { name: "Daily challenge", loading: "Loading today's challenge…" },
  practice: { name: "Practice round", loading: "Shuffling a practice round…" },
  assessment_pre: { name: "Starting check", loading: "Preparing your starting check…" },
  assessment_post: { name: "Final check", loading: "Preparing your final check…" },
};

type Stage =
  | { status: "loading" }
  | { status: "error"; message: string; conflict?: boolean }
  | { status: "playing" }
  | { status: "summary"; summary: RoundSummaryDTO; alreadyDone: boolean };

const DEFAULT_CONFIDENCE = 75;
const MAX_RESPONSE_MS = 30 * 60 * 1000;

const clampConfidence = (c: number) => Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, c));

function toResultMap(answers: AnswerResultDTO[]) {
  return Object.fromEntries(answers.map((a) => [a.itemId, a])) as Record<string, AnswerResultDTO>;
}

export function Game({ kind }: { kind: GameKind }) {
  const [stage, setStage] = useState<Stage>({ status: "loading" });
  const [round, setRound] = useState<RoundDTO | null>(null);
  const [results, setResults] = useState<Record<string, AnswerResultDTO>>({});
  const [index, setIndex] = useState(0);
  const [guess, setGuess] = useState<Label | null>(null);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeClueId, setActiveClueId] = useState<string | null>(null);

  const shownAt = useRef(0);
  const busy = useRef(false);
  const started = useRef(false);
  const itemHeading = useRef<HTMLHeadingElement>(null);
  const revealHeading = useRef<HTMLHeadingElement>(null);
  const mediaBox = useRef<HTMLDivElement>(null);

  const current = round && stage.status === "playing" ? round.items[index] : undefined;
  const currentResult = current ? results[current.id] : undefined;
  const total = round?.items.length ?? 0;
  const score = Object.values(results).reduce((sum, r) => sum + r.points, 0);

  const resetAnswer = () => {
    setGuess(null);
    setConfidence(DEFAULT_CONFIDENCE);
    setActiveClueId(null);
    setActionError(null);
    shownAt.current = performance.now();
  };

  const complete = useCallback(async (roundId: string, alreadyDone: boolean, fromPlay: boolean) => {
    setCompleting(true);
    setActionError(null);
    try {
      const summary = await api.post<RoundSummaryDTO>(`/api/rounds/${roundId}/complete`);
      setStage({ status: "summary", summary, alreadyDone });
    } catch (err) {
      if (fromPlay) setActionError(friendlyError(err));
      else setStage({ status: "error", message: friendlyError(err) });
    } finally {
      setCompleting(false);
    }
  }, []);

  /** Continue a round from its first unanswered item, or go straight to the summary. */
  const applyRound = useCallback(
    (r: RoundDTO) => {
      const map = toResultMap(r.answers);
      setRound(r);
      setResults(map);
      const next = r.items.findIndex((it) => !map[it.id]);
      if (next === -1) {
        void complete(r.id, r.kind === "daily" && r.completedAt !== null, false);
        return;
      }
      setIndex(next);
      setGuess(null);
      setConfidence(DEFAULT_CONFIDENCE);
      setActiveClueId(null);
      setActionError(null);
      shownAt.current = performance.now();
      setStage({ status: "playing" });
    },
    [complete],
  );

  const start = useCallback(async () => {
    setStage({ status: "loading" });
    setRound(null);
    setResults({});
    try {
      await api.post("/api/session");
      applyRound(await api.post<RoundDTO>("/api/rounds", { kind }));
    } catch (err) {
      // 409 means there is simply nothing to play (check already taken, library exhausted).
      setStage({ status: "error", message: friendlyError(err), conflict: err instanceof ApiClientError && err.status === 409 });
    }
  }, [kind, applyRound]);

  /** After an error mid-round, reload the same round instead of starting a new one. */
  const retry = useCallback(async () => {
    if (!round) return start();
    setStage({ status: "loading" });
    try {
      applyRound(await api.get<RoundDTO>(`/api/rounds/${round.id}`));
    } catch (err) {
      setStage({ status: "error", message: friendlyError(err) });
    }
  }, [round, start, applyRound]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const submit = async () => {
    if (!round || !current || !guess || currentResult || busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setActionError(null);
    const body: AnswerInput = {
      itemId: current.id,
      guess,
      confidence,
      responseMs: Math.min(MAX_RESPONSE_MS, Math.max(0, Math.round(performance.now() - shownAt.current))),
    };
    try {
      const res = await api.post<AnswerResultDTO>(`/api/rounds/${round.id}/answers`, body);
      setResults((prev) => ({ ...prev, [res.itemId]: res }));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        // Already answered (e.g. in another tab): pull the stored result and reveal it.
        try {
          const fresh = await api.get<RoundDTO>(`/api/rounds/${round.id}`);
          setResults(toResultMap(fresh.answers));
        } catch (inner) {
          setActionError(friendlyError(inner));
        }
      } else {
        setActionError(friendlyError(err));
      }
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const next = () => {
    if (!round || completing) return;
    const nextIndex = round.items.findIndex((it) => !results[it.id]);
    if (nextIndex === -1) {
      void complete(round.id, false, true);
      return;
    }
    setIndex(nextIndex);
    resetAnswer();
    requestAnimationFrame(() => itemHeading.current?.focus());
  };

  /** Highlight a clue; on stacked (mobile) layouts bring the image back into view so the box is visible. */
  const selectClue = (id: string | null) => {
    setActiveClueId(id);
    const box = mediaBox.current;
    if (!id || !box || window.matchMedia("(min-width: 1024px)").matches) return;
    if (box.getBoundingClientRect().top < 0) {
      const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      box.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    }
  };

  // Move focus to the verdict so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (currentResult) revealHeading.current?.focus();
  }, [currentResult]);

  // Warm the cache for the next image so the stage never waits.
  useEffect(() => {
    const upcoming = round?.items[index + 1];
    if (upcoming?.mediaType === "image") {
      const img = new Image();
      img.src = upcoming.mediaUrl;
    }
  }, [round, index]);

  // Keyboard shortcuts. A ref keeps the window listener stable while reading fresh state.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    onKey.current = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || !current) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      const tag = target?.tagName ?? "";
      const isRange = target instanceof HTMLInputElement && target.type === "range";
      if ((tag === "INPUT" && !isRange) || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      const nativeEnter = tag === "BUTTON" || tag === "A" || tag === "INPUT";
      const key = e.key.toLowerCase();

      if (!currentResult) {
        if (key === "r" || key === "a") {
          e.preventDefault();
          setGuess(key === "r" ? "real" : "ai");
        } else if ((key === "arrowleft" || key === "arrowright") && !isRange && tag !== "VIDEO" && tag !== "AUDIO") {
          e.preventDefault();
          setConfidence((c) => clampConfidence(c + (key === "arrowright" ? 5 : -5)));
        } else if (key === "enter" && !nativeEnter) {
          e.preventDefault();
          void submit();
        }
      } else if (key === "n" || (key === "enter" && !nativeEnter)) {
        e.preventDefault();
        next();
      }
    };
  });
  useEffect(() => {
    const handler = (e: KeyboardEvent) => onKey.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const announcement = currentResult
    ? `${currentResult.correct ? "Correct" : "Wrong"}. It was ${LABEL_NAMES[currentResult.label]}. ${formatPoints(currentResult.points)} points.`
    : "";

  return (
    <section className="bg-brand-dark flex flex-1 flex-col text-white" aria-label={KIND_COPY[kind].name}>
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>

      {stage.status === "loading" && (
        <div className="grid flex-1 place-items-center px-4 py-24">
          <p role="status" className="flex items-center gap-3 text-white/80">
            <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-ora" aria-hidden />
            {KIND_COPY[kind].loading}
          </p>
        </div>
      )}

      {stage.status === "error" && (
        <div className="mx-auto w-full max-w-lg px-4 py-24">
          <h1 className="mb-4 text-2xl font-bold">{stage.conflict ? "Nothing to play here" : "Something went wrong"}</h1>
          <RetryError message={stage.message} onRetry={() => void retry()} />
        </div>
      )}

      {stage.status === "summary" && (
        <div className="px-4 py-10 sm:px-6 sm:py-14">
          <RoundSummary
            summary={stage.summary}
            alreadyDone={stage.alreadyDone}
            onPracticeAgain={kind === "practice" ? () => void start() : undefined}
          />
        </div>
      )}

      {stage.status === "playing" && round && current && (
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-5 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-ora">{kind === "daily" ? "Daily challenge" : "Practice"}</p>
              <h1 ref={itemHeading} tabIndex={-1} className="text-lg font-semibold outline-none">
                Item {index + 1} <span className="text-white/55">of {total}</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <ProgressDots items={round.items} results={results} current={index} />
              <p className="rounded-xl bg-white/8 px-3 py-1.5 text-sm">
                <span className="text-white/60">Score </span>
                <strong className="font-bold">{score}</strong>
              </p>
            </div>
          </div>

          <div className="grid flex-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div ref={mediaBox} className="flex scroll-mt-4 flex-col gap-2">
              <MediaView
                key={current.id}
                item={current}
                label={`Item ${index + 1} of ${total}`}
                clues={currentResult?.clues}
                activeClueId={activeClueId}
                onShown={() => {
                  if (!currentResult) shownAt.current = performance.now();
                }}
              />
              {currentResult && currentResult.clues.some((c) => c.region) && (
                <p className="text-center text-xs text-white/55">Numbered boxes mark the clues. Select a clue to highlight it.</p>
              )}
            </div>

            <div className="rounded-[var(--radius-card)] border border-white/10 bg-plum/70 p-5 backdrop-blur-sm sm:p-6">
              {currentResult ? (
                <RevealPanel
                  ref={revealHeading}
                  result={currentResult}
                  activeClueId={activeClueId}
                  onSelectClue={selectClue}
                  onNext={next}
                  isLast={Object.keys(results).length === total}
                  busy={completing}
                />
              ) : (
                <AnswerControls
                  guess={guess}
                  confidence={confidence}
                  submitting={submitting}
                  onGuess={setGuess}
                  onConfidence={setConfidence}
                  onSubmit={() => void submit()}
                />
              )}
              {actionError && (
                <div className="mt-4">
                  <ErrorNote>{actionError}</ErrorNote>
                </div>
              )}
              <p className="mt-5 hidden items-start gap-2 text-xs leading-relaxed text-white/50 sm:flex">
                <Keyboard className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Shortcuts: <kbd className="font-sans font-semibold text-white/75">R</kbd> real ·{" "}
                  <kbd className="font-sans font-semibold text-white/75">A</kbd> rendered ·{" "}
                  <kbd className="font-sans font-semibold text-white/75">← →</kbd> confidence ·{" "}
                  <kbd className="font-sans font-semibold text-white/75">Enter</kbd> submit ·{" "}
                  <kbd className="font-sans font-semibold text-white/75">N</kbd> next
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

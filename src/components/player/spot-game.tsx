"use client";

import clsx from "clsx";
import { Bot, Camera, Check, Keyboard, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import type { Label, PlayItemDTO, RoundDTO, RoundSummaryDTO, SpotPickInput, SpotResultDTO } from "@/lib/contracts";
import { CONFIDENCE_MAX, CONFIDENCE_MIN } from "@/lib/contracts";
import { Button, ErrorNote } from "@/components/ui";
import { friendlyError } from "./errors";
import { CLUE_KIND_LABELS, formatPoints } from "./labels";
import { RetryError } from "./retry-error";
import { RoundSummary } from "./round-summary";

type Stage =
  | { status: "loading" }
  | { status: "error"; message: string; conflict: boolean }
  | { status: "playing" }
  | { status: "summary"; summary: RoundSummaryDTO };

const DEFAULT_CONFIDENCE = 75;
const MAX_RESPONSE_MS = 30 * 60 * 1000;

const PROMPT: Record<Label, { title: string; hint: string }> = {
  ai: { title: "Find the AI-made one", hint: "Three of these are real photos. One was made by AI." },
  real: { title: "Find the real photo", hint: "Three of these were made by AI. One is a real photo." },
};

function confidenceWord(c: number) {
  if (c < 60) return "Just guessing";
  if (c < 75) return "Leaning";
  if (c < 90) return "Fairly sure";
  return c < 100 ? "Very sure" : "Certain";
}

const clamp = (c: number) => Math.min(CONFIDENCE_MAX, Math.max(CONFIDENCE_MIN, c));

/** "Spot the odd one out": puzzles of four items where exactly one has the other label. */
export function SpotGame() {
  const [stage, setStage] = useState<Stage>({ status: "loading" });
  const [round, setRound] = useState<RoundDTO | null>(null);
  const [results, setResults] = useState<Record<number, SpotResultDTO>>({});
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(DEFAULT_CONFIDENCE);
  const [submitting, setSubmitting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [activeClueId, setActiveClueId] = useState<string | null>(null);

  const shownAt = useRef(0);
  const busy = useRef(false);
  const started = useRef(false);
  const promptHeading = useRef<HTMLHeadingElement>(null);
  const resultHeading = useRef<HTMLHeadingElement>(null);

  const puzzles = round?.puzzles ?? [];
  const puzzle = stage.status === "playing" ? puzzles[index] : undefined;
  const result = puzzle ? results[puzzle.index] : undefined;
  const itemsById = new Map<string, PlayItemDTO>((round?.items ?? []).map((i) => [i.id, i]));
  const score = Object.values(results).reduce((s, r) => s + r.points, 0);

  const resetPick = () => {
    setPicked(null);
    setConfidence(DEFAULT_CONFIDENCE);
    setActiveClueId(null);
    setActionError(null);
    shownAt.current = performance.now();
  };

  const complete = useCallback(async (roundId: string, fromPlay: boolean) => {
    setCompleting(true);
    setActionError(null);
    try {
      setStage({ status: "summary", summary: await api.post<RoundSummaryDTO>(`/api/rounds/${roundId}/complete`) });
    } catch (err) {
      if (fromPlay) setActionError(friendlyError(err));
      else setStage({ status: "error", message: friendlyError(err), conflict: false });
    } finally {
      setCompleting(false);
    }
  }, []);

  const applyRound = useCallback(
    (r: RoundDTO) => {
      const map = Object.fromEntries(r.spotResults.map((x) => [x.puzzle, x])) as Record<number, SpotResultDTO>;
      setRound(r);
      setResults(map);
      const next = (r.puzzles ?? []).findIndex((p) => !map[p.index]);
      if (next === -1) {
        void complete(r.id, false);
        return;
      }
      setIndex(next);
      resetPick();
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
      applyRound(await api.post<RoundDTO>("/api/rounds", { kind: "spot" }));
    } catch (err) {
      setStage({ status: "error", message: friendlyError(err), conflict: err instanceof ApiClientError && err.status === 409 });
    }
  }, [applyRound]);

  const retry = useCallback(async () => {
    if (!round) return start();
    setStage({ status: "loading" });
    try {
      applyRound(await api.get<RoundDTO>(`/api/rounds/${round.id}`));
    } catch (err) {
      setStage({ status: "error", message: friendlyError(err), conflict: false });
    }
  }, [round, start, applyRound]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void start();
  }, [start]);

  const submit = useCallback(async () => {
    if (!round || !puzzle || !picked || busy.current || result) return;
    busy.current = true;
    setSubmitting(true);
    setActionError(null);
    const body: SpotPickInput = {
      puzzle: puzzle.index,
      itemId: picked,
      confidence: clamp(confidence),
      responseMs: Math.min(MAX_RESPONSE_MS, Math.max(0, Math.round(performance.now() - shownAt.current))),
    };
    try {
      const res = await api.post<SpotResultDTO>(`/api/rounds/${round.id}/picks`, body);
      setResults((prev) => ({ ...prev, [res.puzzle]: res }));
      requestAnimationFrame(() => resultHeading.current?.focus());
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) void retry();
      else setActionError(friendlyError(err));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }, [round, puzzle, picked, confidence, result, retry]);

  const next = useCallback(() => {
    if (!round || !result) return;
    if (index + 1 >= puzzles.length) {
      void complete(round.id, true);
      return;
    }
    setIndex(index + 1);
    resetPick();
    requestAnimationFrame(() => promptHeading.current?.focus());
  }, [round, result, index, puzzles.length, complete]);

  // Keyboard: 1–4 pick, ←/→ confidence, Enter lock in, N next.
  const onKey = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    onKey.current = (e: KeyboardEvent) => {
      if (stage.status !== "playing" || !puzzle || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
      if (!result) {
        const n = Number(e.key);
        if (n >= 1 && n <= puzzle.itemIds.length) {
          setPicked(puzzle.itemIds[n - 1]);
          return;
        }
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          setConfidence((c) => clamp(c + (e.key === "ArrowRight" ? 5 : -5)));
          return;
        }
        if (e.key === "Enter" && tag !== "BUTTON" && tag !== "A") {
          e.preventDefault();
          void submit();
        }
      } else if (e.key === "n" || e.key === "N") {
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

  const fill = ((confidence - CONFIDENCE_MIN) / (CONFIDENCE_MAX - CONFIDENCE_MIN)) * 100;
  const labelOf = (id: string) => result?.items.find((i) => i.itemId === id)?.label;

  return (
    <section className="bg-brand-dark flex flex-1 flex-col text-white" aria-label="Spot the fake">
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {result ? `${result.correct ? "Correct" : "Not this time"}. ${formatPoints(result.points)} points.` : ""}
      </p>

      {stage.status === "loading" && (
        <div className="grid flex-1 place-items-center px-4 py-24">
          <p role="status" className="flex items-center gap-3 text-white/80">
            <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-ora" aria-hidden />
            Setting up your puzzles…
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
        <div className="px-4 py-10 sm:py-14">
          <RoundSummary summary={stage.summary} alreadyDone={false} onPracticeAgain={() => void start()} />
        </div>
      )}

      {stage.status === "playing" && puzzle && (
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-ora">
              Spot the fake · Puzzle {index + 1} of {puzzles.length}
            </p>
            <p className="text-sm text-white/70">
              Score <span className="font-bold text-white">{score}</span>
            </p>
          </div>
          <ol className="mt-3 flex gap-1.5" aria-label="Puzzle progress">
            {puzzles.map((p) => {
              const r = results[p.index];
              return (
                <li
                  key={p.index}
                  className={clsx("h-1.5 flex-1 rounded-full", r ? (r.correct ? "bg-ora" : "bg-wine") : p.index === index ? "bg-white/60" : "bg-white/15")}
                >
                  <span className="sr-only">
                    Puzzle {p.index + 1}: {r ? (r.correct ? "correct" : "missed") : p.index === index ? "current" : "to do"}
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="mt-6">
            <h1 ref={promptHeading} tabIndex={-1} className="flex items-center gap-3 text-2xl font-bold outline-none sm:text-3xl">
              {puzzle.find === "ai" ? <Bot className="size-7 text-ora" aria-hidden /> : <Camera className="size-7 text-ora" aria-hidden />}
              {PROMPT[puzzle.find].title}
            </h1>
            <p className="mt-1 text-white/70">{PROMPT[puzzle.find].hint}</p>
          </div>

          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div role="radiogroup" aria-label="Choose one image" className="grid min-w-0 grid-cols-2 content-start gap-2 sm:gap-3 lg:sticky lg:top-6">
              {puzzle.itemIds.map((id, i) => {
                const item = itemsById.get(id);
                const selected = picked === id;
                const isOdd = result?.oddItemId === id;
                const wasPicked = result?.pickedItemId === id;
                const label = labelOf(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-keyshortcuts={String(i + 1)}
                    aria-label={`Image ${i + 1}${label ? `: ${label === "ai" ? "AI-made" : "real"}${isOdd ? ", the odd one out" : ""}${wasPicked ? ", your pick" : ""}` : ""}`}
                    disabled={Boolean(result)}
                    onClick={() => setPicked(id)}
                    className={clsx(
                      "group relative aspect-[4/3] min-w-0 overflow-hidden rounded-2xl bg-plum-2 text-left outline-offset-4 transition disabled:cursor-default",
                      !result && (selected ? "ring-4 ring-ora" : "ring-1 ring-white/15 hover:ring-white/40"),
                      result && isOdd && "ring-4 ring-ora",
                      result && wasPicked && !isOdd && "ring-4 ring-wine",
                      result && !isOdd && !wasPicked && "opacity-70",
                    )}
                  >
                    {item && (
                      // eslint-disable-next-line @next/next/no-img-element -- media are same-origin, already sized for display
                      <img src={item.mediaUrl} alt="" className="size-full object-cover" draggable={false} />
                    )}
                    <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-plum/80 text-sm font-bold">{i + 1}</span>
                    {label && (
                      <span
                        className={clsx(
                          "absolute right-2 top-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold",
                          label === "ai" ? "bg-gradient-ora text-white" : "bg-white text-plum",
                        )}
                      >
                        {label === "ai" ? <Bot className="size-3.5" aria-hidden /> : <Camera className="size-3.5" aria-hidden />}
                        {label === "ai" ? "AI-made" : "Real"}
                      </span>
                    )}
                    {result && (isOdd || wasPicked) && (
                      <span className="absolute bottom-2 left-2 rounded-lg bg-plum/85 px-2 py-1 text-xs font-semibold">
                        {isOdd && wasPicked ? "Odd one · your pick" : isOdd ? "The odd one out" : "Your pick"}
                      </span>
                    )}
                    {isOdd &&
                      result?.clues.map(
                        (c, n) =>
                          c.region && (
                            <span
                              key={c.id}
                              aria-hidden
                              className={clsx(
                                "absolute rounded-md border-2 transition",
                                activeClueId === null || activeClueId === c.id ? "border-ora shadow-[0_0_12px_rgb(255_138_30/0.7)]" : "border-white/30",
                              )}
                              style={{ left: `${c.region.x * 100}%`, top: `${c.region.y * 100}%`, width: `${c.region.w * 100}%`, height: `${c.region.h * 100}%` }}
                            >
                              <span className="absolute -left-2 -top-2 grid size-5 place-items-center rounded-full bg-ora text-[10px] font-bold text-white">{n + 1}</span>
                            </span>
                          ),
                      )}
                  </button>
                );
              })}
            </div>

            <div className="flex min-w-0 flex-col gap-5">
              {!result ? (
                <form
                  className="flex flex-col gap-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                >
                  <div>
                    <div className="mb-2 flex items-baseline justify-between gap-3">
                      <label htmlFor="spot-confidence" className="text-sm font-semibold text-white/80">
                        How sure are you?
                      </label>
                      <output htmlFor="spot-confidence" className="text-sm text-white/70">
                        <span className="text-lg font-bold text-ora">{confidence}%</span> · {confidenceWord(confidence)}
                      </output>
                    </div>
                    <input
                      id="spot-confidence"
                      type="range"
                      min={CONFIDENCE_MIN}
                      max={CONFIDENCE_MAX}
                      step={5}
                      value={confidence}
                      aria-valuetext={`${confidence}%, ${confidenceWord(confidence)}`}
                      onChange={(e) => setConfidence(Number(e.target.value))}
                      className={clsx(
                        "h-2 w-full cursor-pointer appearance-none rounded-full",
                        "[&::-webkit-slider-thumb]:size-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-ora [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md",
                        "[&::-moz-range-thumb]:size-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-4 [&::-moz-range-thumb]:border-ora [&::-moz-range-thumb]:bg-white",
                      )}
                      style={{ background: `linear-gradient(90deg, var(--color-ora) ${fill}%, rgb(255 255 255 / 0.15) ${fill}%)` }}
                    />
                    <div className="mt-1.5 flex justify-between text-xs text-white/55" aria-hidden>
                      <span>Just guessing</span>
                      <span>Certain</span>
                    </div>
                  </div>
                  <Button type="submit" size="lg" disabled={!picked || submitting} className="w-full">
                    {submitting ? "Checking…" : picked ? "Lock in answer" : "Tap the odd one out"}
                  </Button>
                  {actionError && <ErrorNote>{actionError}</ErrorNote>}
                  <p className="hidden items-center gap-2 text-xs text-white/50 sm:flex">
                    <Keyboard className="size-4" aria-hidden /> Keys: 1–4 pick · ← → confidence · Enter lock in
                  </p>
                </form>
              ) : (
                <section aria-labelledby="spot-result" className="flex flex-col gap-4">
                  <div className={clsx("flex items-start gap-3 rounded-2xl p-4", result.correct ? "bg-gradient-ora" : "border border-white/15 bg-white/6")}>
                    <span className={clsx("grid size-10 shrink-0 place-items-center rounded-full", result.correct ? "bg-white text-ora-deep" : "bg-wine text-white")}>
                      {result.correct ? <Check className="size-6" strokeWidth={3} aria-hidden /> : <X className="size-6" strokeWidth={3} aria-hidden />}
                    </span>
                    <div>
                      <h2 id="spot-result" ref={resultHeading} tabIndex={-1} className="text-xl font-bold outline-none">
                        {result.correct ? "Correct!" : "Not this time"} <span className="text-base font-semibold">{formatPoints(result.points)}</span>
                      </h2>
                      <p className="text-sm text-white/85">
                        The odd one out was image {puzzle.itemIds.indexOf(result.oddItemId) + 1}: the only {result.find === "ai" ? "AI-made image" : "real photo"}.
                      </p>
                    </div>
                  </div>

                  {result.clues.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-white/80">Why it stands out</h3>
                      <ul className="mt-2 flex flex-col gap-2">
                        {result.clues.map((c, n) => (
                          <li key={c.id}>
                            <button
                              type="button"
                              onClick={() => setActiveClueId(activeClueId === c.id ? null : c.id)}
                              aria-pressed={activeClueId === c.id}
                              className={clsx(
                                "w-full rounded-xl border p-3 text-left text-sm transition",
                                activeClueId === c.id ? "border-ora bg-white/10" : "border-white/10 bg-white/5 hover:bg-white/8",
                              )}
                            >
                              <span className="flex items-center gap-2 font-semibold">
                                <span className="grid size-5 place-items-center rounded-full bg-ora text-[10px] font-bold">{n + 1}</span>
                                {c.title}
                              </span>
                              <span className="mt-1 block text-white/75">{c.explanation}</span>
                              <span className="mt-1 block text-xs text-white/45">{CLUE_KIND_LABELS[c.kind]}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <details className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                    <summary className="cursor-pointer text-sm font-semibold text-white/80">Sources and licences</summary>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {puzzle.itemIds.map((id, i) => {
                        const it = result.items.find((x) => x.itemId === id);
                        if (!it) return null;
                        return (
                          <li key={id}>
                            {i + 1}. {it.label === "ai" ? `AI-made (${it.source.generator})` : "Real"} · {it.source.attribution} ·{" "}
                            <a href={it.source.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                              {it.source.name}
                            </a>{" "}
                            ·{" "}
                            {it.source.licenseUrl ? (
                              <a href={it.source.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-white">
                                {it.source.license}
                              </a>
                            ) : (
                              it.source.license
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </details>

                  <Button size="lg" onClick={next} disabled={completing} aria-keyshortcuts="N" className="w-full">
                    {completing ? "Scoring your round…" : index + 1 >= puzzles.length ? "See your results" : "Next puzzle"}
                  </Button>
                  {actionError && <ErrorNote>{actionError}</ErrorNote>}
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

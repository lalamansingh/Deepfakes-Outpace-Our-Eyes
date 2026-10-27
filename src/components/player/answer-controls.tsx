"use client";

import clsx from "clsx";
import { Bot, Camera, Send } from "lucide-react";
import { CONFIDENCE_MAX, CONFIDENCE_MIN, type Label } from "@/lib/contracts";
import { Button } from "@/components/ui";

type Props = {
  guess: Label | null;
  confidence: number;
  submitting: boolean;
  onGuess: (g: Label) => void;
  onConfidence: (c: number) => void;
  onSubmit: () => void;
};

const choices = [
  { value: "real" as const, title: "Real", hint: "Captured by a camera or microphone", icon: Camera, key: "R" },
  { value: "ai" as const, title: "Rendered", hint: "Made or altered by AI", icon: Bot, key: "A" },
];

function confidenceWord(c: number) {
  if (c <= 55) return "Just guessing";
  if (c <= 70) return "Leaning";
  if (c <= 85) return "Fairly sure";
  if (c < 100) return "Very sure";
  return "Certain";
}

export function AnswerControls({ guess, confidence, submitting, onGuess, onConfidence, onSubmit }: Props) {
  const fill = ((confidence - CONFIDENCE_MIN) / (CONFIDENCE_MAX - CONFIDENCE_MIN)) * 100;
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-white/80">Is this real or rendered?</legend>
        <div className="grid grid-cols-2 gap-3">
          {choices.map(({ value, title, hint, icon: Icon, key }) => {
            const selected = guess === value;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                aria-keyshortcuts={key}
                onClick={() => onGuess(value)}
                className={clsx(
                  "group relative flex min-h-24 flex-col items-start justify-between gap-2 rounded-2xl border-2 p-4 text-left transition",
                  selected
                    ? value === "real"
                      ? "border-transparent bg-gradient-wine text-white shadow-[0_12px_30px_rgb(139_16_64/0.45)]"
                      : "border-transparent bg-gradient-ora text-white shadow-[0_12px_30px_rgb(255_113_58/0.4)]"
                    : "border-white/15 bg-white/5 text-white hover:border-white/35 hover:bg-white/10",
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <Icon className="size-6" aria-hidden />
                  <kbd
                    className={clsx(
                      "hidden rounded-md border px-1.5 py-0.5 font-sans text-[11px] font-semibold sm:inline",
                      selected ? "border-white/50 text-white" : "border-white/25 text-white/60",
                    )}
                    aria-hidden
                  >
                    {key}
                  </kbd>
                </span>
                <span>
                  <span className="block text-lg font-bold leading-tight sm:text-xl">{title}</span>
                  <span className={clsx("block text-xs leading-snug", selected ? "text-white/90" : "text-white/60")}>{hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <label htmlFor="confidence" className="text-sm font-semibold text-white/80">
            How sure are you?
          </label>
          <output htmlFor="confidence" className="text-sm text-white/70" aria-live="off">
            <span className="text-lg font-bold text-ora">{confidence}%</span> · {confidenceWord(confidence)}
          </output>
        </div>
        <input
          id="confidence"
          type="range"
          min={CONFIDENCE_MIN}
          max={CONFIDENCE_MAX}
          step={5}
          value={confidence}
          aria-valuetext={`${confidence}%, ${confidenceWord(confidence)}`}
          onChange={(e) => onConfidence(Number(e.target.value))}
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

      <Button type="submit" disabled={!guess || submitting} className="w-full py-4 text-base" aria-keyshortcuts="Enter">
        <Send className="size-4" aria-hidden />
        {submitting ? "Checking…" : guess ? "Lock in answer" : "Pick Real or Rendered"}
      </Button>
    </form>
  );
}

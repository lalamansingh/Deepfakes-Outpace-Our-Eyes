"use client";

import clsx from "clsx";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

/** Copies text to the clipboard and announces the result to screen readers. */
export function CopyButton({ value, label, tone = "light", className }: { value: string; label: string; tone?: "light" | "dark"; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (state === "idle") return;
    const t = window.setTimeout(() => setState("idle"), 2000);
    return () => window.clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition",
        tone === "light" ? "text-wine hover:bg-tint" : "bg-white/10 text-white hover:bg-white/20",
        className,
      )}
    >
      {state === "copied" ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : "Copy"}</span>
    </button>
  );
}

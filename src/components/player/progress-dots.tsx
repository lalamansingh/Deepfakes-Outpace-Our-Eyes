import clsx from "clsx";
import { Check, X } from "lucide-react";
import type { AnswerResultDTO, PlayItemDTO } from "@/lib/contracts";

/** One dot per item: answered dots show ✓/✗ (icon, not just colour), the current one is enlarged. */
export function ProgressDots({
  items,
  results,
  current,
}: {
  items: PlayItemDTO[];
  results: Record<string, AnswerResultDTO>;
  current: number;
}) {
  const answered = Object.keys(results).length;
  return (
    <ol className="flex items-center gap-1.5" aria-label={`Progress: ${answered} of ${items.length} answered`}>
        {items.map((item, i) => {
          const r = results[item.id];
          const isCurrent = i === current && !r;
          return (
            <li
              key={item.id}
              className={clsx(
                "grid place-items-center rounded-full transition-all",
                r ? "size-5" : isCurrent ? "h-2.5 w-6 bg-ora" : "size-2.5 bg-white/20",
                r && (r.correct ? "bg-ora text-plum" : "bg-wine text-white"),
              )}
            >
              {r ? (
                r.correct ? (
                  <Check className="size-3" strokeWidth={3.5} aria-hidden />
                ) : (
                  <X className="size-3" strokeWidth={3.5} aria-hidden />
                )
              ) : null}
              <span className="sr-only">
                Item {i + 1}: {r ? (r.correct ? "correct" : "wrong") : isCurrent ? "current" : "to do"}
              </span>
            </li>
          );
        })}
    </ol>
  );
}

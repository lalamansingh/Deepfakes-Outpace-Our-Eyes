"use client";

import { useEffect, useId, useRef, useState } from "react";
import { percent } from "@/components/ui";
import type { ClassDashboardDTO } from "@/lib/contracts";
import { CLUE_KIND_LABELS } from "./labels";
import { formatWeek } from "./format";

type Week = ClassDashboardDTO["accuracyByWeek"][number];

const H = 260;
const PAD = { top: 16, right: 20, bottom: 36, left: 44 };

/** Tracks an element's width so the SVG is drawn at 1:1 scale (text stays legible on phones). */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}
const GRID = [0, 0.25, 0.5, 0.75, 1];

/**
 * Single-series line chart of weekly accuracy. Weeks without answers break the
 * line (a gap) rather than being drawn as 0%.
 */
export function AccuracyLineChart({ weeks }: { weeks: Week[] }) {
  const tableId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [wrapRef, measured] = useWidth(640);
  const W = Math.max(measured, 260);
  const narrow = W < 480;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const step = weeks.length > 1 ? plotW / (weeks.length - 1) : 0;
  const x = (i: number) => PAD.left + (weeks.length > 1 ? i * step : plotW / 2);
  const y = (v: number) => PAD.top + (1 - v) * plotH;

  let path = "";
  let penDown = false;
  weeks.forEach((w, i) => {
    if (w.answered === 0) {
      penDown = false;
      return;
    }
    path += `${penDown ? "L" : "M"}${x(i).toFixed(1)},${y(w.accuracy).toFixed(1)} `;
    penDown = true;
  });

  const withData = weeks.filter((w) => w.answered > 0);
  const summary =
    withData.length === 0
      ? "No answers in the last 8 weeks yet."
      : `Weekly class accuracy over the last ${weeks.length} weeks. ${withData.length} weeks have answers; latest week with data: ${percent(
          withData[withData.length - 1].accuracy,
        )} accuracy, lowest ${percent(Math.min(...withData.map((w) => w.accuracy)))}, highest ${percent(Math.max(...withData.map((w) => w.accuracy)))}.`;

  const active = hover !== null ? weeks[hover] : null;

  return (
    <figure className="m-0">
      <div className="relative" ref={wrapRef}>
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" height={H} role="img" aria-label={summary} aria-describedby={tableId}>
          {GRID.map((g) => (
            <g key={g}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} className="stroke-line" strokeWidth={1} strokeDasharray={g === 0 ? undefined : "3 4"} />
              <text x={PAD.left - 10} y={y(g)} textAnchor="end" dominantBaseline="middle" className="fill-subtle text-[11px]">
                {g * 100}%
              </text>
            </g>
          ))}
          {weeks.map((w, i) => (
            <text key={w.weekStart} x={x(i)} visibility={narrow && i % 2 === 1 ? "hidden" : undefined} y={H - 12} textAnchor="middle" className={w.answered === 0 ? "fill-subtle text-[11px]" : "fill-muted text-[11px]"}>
              {formatWeek(w.weekStart)}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-plum-3/40" strokeWidth={1} />}
          <path d={path} fill="none" className="stroke-wine" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          {weeks.map((w, i) =>
            w.answered === 0 ? (
              <g key={w.weekStart} aria-hidden>
                <line x1={x(i) - 4} x2={x(i) + 4} y1={PAD.top + plotH} y2={PAD.top + plotH} className="stroke-subtle" strokeWidth={2} strokeLinecap="round" />
              </g>
            ) : (
              <circle
                key={w.weekStart}
                cx={x(i)}
                cy={y(w.accuracy)}
                r={hover === i ? 6 : 4.5}
                className="fill-wine stroke-white"
                strokeWidth={2}
              />
            ),
          )}
          {/* Generous invisible hit targets, one per week column. */}
          {weeks.map((w, i) => (
            <rect
              key={w.weekStart}
              x={x(i) - (step || plotW) / 2}
              y={PAD.top}
              width={step || plotW}
              height={plotH}
              fill="transparent"
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover((h) => (h === i ? null : h))}
            />
          ))}
        </svg>
        {active && hover !== null && (
          <div
            aria-hidden
            className="pointer-events-none absolute top-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-plum px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 18), 82)}%` }}
          >
            <span className="font-semibold">Week of {formatWeek(active.weekStart)}</span>
            <br />
            {active.answered === 0 ? "No answers" : `${percent(active.accuracy)} · ${active.answered} answers`}
          </div>
        )}
      </div>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-4 rounded bg-wine" /> Class accuracy
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-0.5 w-2 rounded bg-subtle" /> Week with no answers (gap)
        </span>
      </figcaption>
      <div id={tableId} className="sr-only">
      <table>
        <caption>Class accuracy by week</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Answers</th>
            <th scope="col">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => (
            <tr key={w.weekStart}>
              <td>{formatWeek(w.weekStart)}</td>
              <td>{w.answered}</td>
              <td>{w.answered === 0 ? "no data" : percent(w.accuracy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}

type Tag = ClassDashboardDTO["accuracyByTag"][number];

/** Horizontal bars, lowest accuracy first; the weakest bar is emphasised. */
export function ClueTypeBars({ tags }: { tags: Tag[] }) {
  const sorted = [...tags].sort((a, b) => a.accuracy - b.accuracy);
  return (
    <ul className="space-y-3.5" aria-label="Accuracy by clue type, hardest first">
      {sorted.map((t, i) => (
        <li key={t.tag}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate font-medium text-ink">{CLUE_KIND_LABELS[t.tag]}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <span className="font-semibold text-ink">{percent(t.accuracy)}</span>
              <span className="text-xs"> · {t.answered} answers</span>
            </span>
          </div>
          <div
            className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-tint"
            role="meter"
            aria-label={`${CLUE_KIND_LABELS[t.tag]} accuracy`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(t.accuracy * 100)}
            aria-valuetext={`${percent(t.accuracy)} from ${t.answered} answers`}
          >
            <div className={i === 0 ? "h-full rounded-full bg-gradient-ora" : "h-full rounded-full bg-wine"} style={{ width: `${Math.max(t.accuracy * 100, 1)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Pre vs post assessment accuracy: two bars and the change in points. */
export function PrePostBars({ pre, post }: { pre: { students: number; accuracy: number }; post: { students: number; accuracy: number } }) {
  const delta = Math.round((post.accuracy - pre.accuracy) * 100);
  const rows = [
    { key: "pre", name: "Before (assessment A)", value: pre, bar: "bg-plum-3" },
    { key: "post", name: "After (assessment B)", value: post, bar: "bg-wine" },
  ];
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tight text-ink">
          {delta > 0 ? "+" : ""}
          {delta} pts
        </p>
        <p className="text-sm text-muted">{delta > 0 ? "improvement" : delta < 0 ? "change" : "no change"}</p>
      </div>
      <ul className="mt-5 space-y-4">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium text-ink">{r.name}</span>
              <span className="tabular-nums text-muted">
                <span className="font-semibold text-ink">{percent(r.value.accuracy)}</span>
                <span className="text-xs">
                  {" "}
                  · {r.value.students} {r.value.students === 1 ? "student" : "students"}
                </span>
              </span>
            </div>
            <div
              className="mt-1.5 h-4 overflow-hidden rounded-md bg-tint"
              role="meter"
              aria-label={`${r.name} accuracy`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(r.value.accuracy * 100)}
              aria-valuetext={percent(r.value.accuracy)}
            >
              <div className={`h-full rounded-md ${r.bar}`} style={{ width: `${Math.max(r.value.accuracy * 100, 1)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

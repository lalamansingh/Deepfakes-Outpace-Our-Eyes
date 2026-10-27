"use client";

import clsx from "clsx";
import { useState, type PointerEvent } from "react";
import type { Region } from "@/lib/contracts";

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** Builds a region from two corner points (fractions), rounded to 3 decimals and kept inside the media. */
export function regionFromPoints(a: { x: number; y: number }, b: { x: number; y: number }): Region {
  const x = round3(Math.min(a.x, b.x));
  const y = round3(Math.min(a.y, b.y));
  const w = Math.min(round3(Math.abs(a.x - b.x)), round3(1 - x));
  const h = Math.min(round3(Math.abs(a.y - b.y)), round3(1 - y));
  return { x, y, w, h };
}

const MIN_SIZE = 0.01;

type Point = { x: number; y: number };

/**
 * Image preview with clue regions drawn on top. Click-and-drag (mouse, pen or
 * touch) draws a rectangle for the selected clue. Numeric inputs elsewhere offer
 * the keyboard-accessible equivalent.
 */
export function RegionCanvas({
  src,
  alt,
  regions,
  selected,
  onSelect,
  onDraw,
}: {
  src: string;
  alt: string;
  regions: (Region | null)[];
  selected: number | null;
  onSelect: (index: number) => void;
  onDraw: (region: Region) => void;
}) {
  const [drag, setDrag] = useState<{ start: Point; current: Point; pointerId: number } | null>(null);

  const toPoint = (e: PointerEvent<HTMLDivElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: clamp01((e.clientX - rect.left) / rect.width), y: clamp01((e.clientY - rect.top) / rect.height) };
  };

  const canDraw = selected !== null;

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!canDraw || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPoint(e);
    setDrag({ start: p, current: p, pointerId: e.pointerId });
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    setDrag({ ...drag, current: toPoint(e) });
  };

  const finish = (e: PointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!drag || drag.pointerId !== e.pointerId) return;
    const region = regionFromPoints(drag.start, toPoint(e));
    setDrag(null);
    if (commit && region.w >= MIN_SIZE && region.h >= MIN_SIZE) onDraw(region);
  };

  const draft = drag ? regionFromPoints(drag.start, drag.current) : null;

  return (
    <div className="relative select-none overflow-hidden rounded-xl border border-line bg-plum">
      {/* eslint-disable-next-line @next/next/no-img-element -- uploaded media of arbitrary size */}
      <img src={src} alt={alt} draggable={false} className="block h-auto w-full" />
      <div
        className={clsx("absolute inset-0 touch-none", canDraw ? "cursor-crosshair" : "cursor-default")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => finish(e, true)}
        onPointerCancel={(e) => finish(e, false)}
        aria-hidden
      >
        {regions.map((r, i) => {
          if (!r) return null;
          const isSelected = i === selected;
          const hidden = isSelected && draft !== null;
          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => {
                // Clicking another clue's box selects it instead of drawing over it.
                if (!isSelected) {
                  e.stopPropagation();
                  onSelect(i);
                }
              }}
              className={clsx(
                "absolute rounded-sm border-2 transition-colors",
                hidden && "opacity-0",
                isSelected ? "pointer-events-none z-10 border-ora bg-ora/15 shadow-[0_0_0_1px_rgb(28_9_28/0.6)]" : "border-white/90 bg-wine/10 shadow-[0_0_0_1px_rgb(139_16_64/0.9)]",
              )}
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
            >
              <span
                className={clsx(
                  "absolute -left-0.5 -top-0.5 grid size-5 place-items-center rounded-br-md text-[11px] font-bold",
                  isSelected ? "bg-ora text-plum" : "bg-wine text-white",
                )}
              >
                {i + 1}
              </span>
            </button>
          );
        })}
        {draft && (
          <div
            className="pointer-events-none absolute z-20 rounded-sm border-2 border-dashed border-ora bg-ora/20"
            style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }}
          />
        )}
      </div>
    </div>
  );
}

"use client";

import clsx from "clsx";
import { AudioLines } from "lucide-react";
import { useState } from "react";
import type { ClueDTO, PlayItemDTO } from "@/lib/contracts";

type Props = {
  item: PlayItemDTO;
  /** e.g. "Item 3 of 8" — never describes the content, so it cannot leak the answer. */
  label: string;
  /** Clues are only passed after the answer is revealed. */
  clues?: ClueDTO[];
  activeClueId?: string | null;
  onShown: () => void;
};

/** Displays one media item with optional clue regions drawn on top (positions in %). */
export function MediaView({ item, label, clues, activeClueId, onShown }: Props) {
  const [natural, setNatural] = useState<number | null>(null);
  const ratio = item.width && item.height ? item.width / item.height : (natural ?? 4 / 3);

  if (item.mediaType === "audio") {
    return (
      <figure className="mx-auto w-full max-w-xl rounded-[var(--radius-card)] border border-white/10 bg-plum-2 p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-wine">
            <AudioLines className="size-7 text-white" aria-hidden />
          </span>
          <figcaption>
            <p className="font-semibold text-white">{label}</p>
            <p className="text-sm text-white/65">Listen closely: breathing, rhythm and background noise.</p>
          </figcaption>
        </div>
        <audio controls preload="auto" src={item.mediaUrl} onLoadedMetadata={onShown} className="mt-6 w-full" aria-label={label}>
          Your browser cannot play this audio clip.
        </audio>
      </figure>
    );
  }

  const regions = (clues ?? []).flatMap((clue, i) => (clue.region ? [{ clue, region: clue.region, n: i + 1 }] : []));

  return (
    <figure
      className="relative mx-auto overflow-hidden rounded-[var(--radius-card)] bg-plum-2 shadow-[0_24px_60px_rgb(0_0_0/0.45)] ring-1 ring-white/10"
      style={{ aspectRatio: String(ratio), width: `min(100%, calc(58dvh * ${ratio}))` }}
    >
      {item.mediaType === "video" ? (
        <video
          controls
          playsInline
          preload="metadata"
          src={item.mediaUrl}
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) setNatural(v.videoWidth / v.videoHeight);
            onShown();
          }}
          aria-label={label}
          className="block size-full object-contain"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- same-origin media of arbitrary size; overlays need the exact rendered box
        <img
          src={item.mediaUrl}
          alt={label}
          width={item.width ?? undefined}
          height={item.height ?? undefined}
          draggable={false}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) setNatural(img.naturalWidth / img.naturalHeight);
            onShown();
          }}
          className="block size-full select-none object-contain"
        />
      )}
      {regions.length > 0 && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {regions.map(({ clue, region: r, n }) => {
            const active = activeClueId === clue.id;
            const dimmed = activeClueId != null && !active;
            return (
              <div
                key={clue.id}
                className={clsx(
                  "absolute rounded-lg border-[3px] transition-all duration-200",
                  active ? "border-ora bg-ora/15 shadow-[0_0_0_4px_rgb(28_9_28/0.55)]" : "border-white/90 shadow-[0_0_0_2px_rgb(28_9_28/0.5)]",
                  dimmed && "opacity-35",
                )}
                style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
              >
                <span
                  className={clsx(
                    "absolute -left-[3px] -top-[3px] grid size-6 place-items-center rounded-br-lg rounded-tl-md text-xs font-bold",
                    active ? "bg-ora text-plum" : "bg-white text-plum",
                  )}
                >
                  {n}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </figure>
  );
}

/**
 * Brings every bundled image in content/seed/items.json to the standard frame
 * (1024×768, 4:3, JPEG, no metadata) so an item's shape or size never hints at
 * whether it is real or AI-made. The crop window is placed to keep the clue
 * regions in view, and the regions are re-mapped to the new frame. A region that
 * would lose more than 40% of its area is dropped and reported for review.
 * Usage: npx tsx scripts/normalize-media.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { ItemInput, Region } from "../src/lib/contracts";

export const BUNDLED_WIDTH = 1024;
export const BUNDLED_HEIGHT = 768;
const ASPECT = BUNDLED_WIDTH / BUNDLED_HEIGHT;

type Window = { left: number; top: number; width: number; height: number };

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** The 4:3 window inside a W×H image that keeps the most clue-region area visible (centre on ties). */
export function bestWindow(W: number, H: number, regions: Region[]): Window {
  const cropX = W / H > ASPECT;
  const width = cropX ? Math.round(H * ASPECT) : W;
  const height = cropX ? H : Math.round(W / ASPECT);
  const slack = cropX ? W - width : H - height;
  const steps = 100;
  let best = { offset: Math.round(slack / 2), score: -1, dist: Infinity };
  for (let i = 0; i <= steps; i++) {
    const offset = Math.round((slack * i) / steps);
    let score = 0;
    for (const r of regions) {
      score += cropX
        ? overlap(offset, offset + width, r.x * W, (r.x + r.w) * W) * r.h * H
        : overlap(offset, offset + height, r.y * H, (r.y + r.h) * H) * r.w * W;
    }
    const dist = Math.abs(offset - slack / 2);
    if (score > best.score + 1e-6 || (Math.abs(score - best.score) <= 1e-6 && dist < best.dist)) best = { offset, score, dist };
  }
  return cropX ? { left: best.offset, top: 0, width, height } : { left: 0, top: best.offset, width, height };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Maps a region into the cropped frame; null when too much of it falls outside. */
export function mapRegion(r: Region, W: number, H: number, win: Window): Region | null {
  const x0 = Math.max(r.x * W, win.left);
  const y0 = Math.max(r.y * H, win.top);
  const x1 = Math.min((r.x + r.w) * W, win.left + win.width);
  const y1 = Math.min((r.y + r.h) * H, win.top + win.height);
  if (x1 <= x0 || y1 <= y0) return null;
  const kept = ((x1 - x0) * (y1 - y0)) / (r.w * W * r.h * H);
  if (kept < 0.6) return null;
  const x = round3((x0 - win.left) / win.width);
  const y = round3((y0 - win.top) / win.height);
  return {
    x,
    y,
    w: Math.max(0.001, Math.min(round3((x1 - x0) / win.width), round3(1 - x))),
    h: Math.max(0.001, Math.min(round3((y1 - y0) / win.height), round3(1 - y))),
  };
}

async function main() {
  const root = process.cwd();
  const file = path.join(root, "content/seed/items.json");
  const items = JSON.parse(readFileSync(file, "utf8")) as ItemInput[];
  const review: string[] = [];
  let changed = 0;

  for (const item of items) {
    if (item.mediaType !== "image") continue;
    const abs = path.join(root, "public", item.mediaUrl);
    const input = readFileSync(abs);
    const meta = await sharp(input).metadata();
    const W = meta.width!;
    const H = meta.height!;
    const clean = !meta.exif && !meta.icc && !meta.xmp && !meta.iptc;
    if (W === BUNDLED_WIDTH && H === BUNDLED_HEIGHT && meta.format === "jpeg" && clean) continue;

    const regions = item.clues.map((c) => c.region).filter((r): r is Region => Boolean(r));
    const win = bestWindow(W, H, regions);
    const output = await sharp(input)
      .rotate()
      .extract(win)
      .resize(BUNDLED_WIDTH, BUNDLED_HEIGHT, { fit: "fill" })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer();
    writeFileSync(abs, output);

    for (const clue of item.clues) {
      if (!clue.region) continue;
      const mapped = mapRegion(clue.region, W, H, win);
      if (!mapped) review.push(`${item.slug}: clue "${clue.title}" lost its region in the crop — check the wording`);
      clue.region = mapped;
    }
    item.width = BUNDLED_WIDTH;
    item.height = BUNDLED_HEIGHT;
    changed++;
  }

  writeFileSync(file, `${JSON.stringify(items, null, 2)}\n`);
  console.log(`normalized ${changed} of ${items.length} items to ${BUNDLED_WIDTH}×${BUNDLED_HEIGHT}`);
  if (review.length) console.log(`\nneeds review:\n- ${review.join("\n- ")}`);
}

if (process.argv[1]?.endsWith("normalize-media.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

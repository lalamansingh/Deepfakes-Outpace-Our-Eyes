/**
 * Validates content/seed/items.json against the item contract and checks that
 * every media file exists, slugs are unique, and the set is balanced.
 * Usage: npx tsx scripts/validate-content.ts
 */
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { itemInputSchema } from "../src/lib/contracts";
import { BUNDLED_HEIGHT, BUNDLED_WIDTH } from "./normalize-media";

/** Words that would leak the answer through a file name or URL. */
const LEAKY = new Set(["ai", "real", "fake", "generated", "synthetic", "render", "rendered", "sd", "sdxl", "midjourney", "dalle", "flux", "photo", "genuine"]);

const root = path.resolve(__dirname, "..");
const file = path.join(root, "content/seed/items.json");
if (!existsSync(file)) {
  console.error("content/seed/items.json is missing: the game has no content to play.");
  process.exit(1);
}
const raw = JSON.parse(readFileSync(file, "utf8")) as unknown[];
const imageChecks: Promise<void>[] = [];
const errors: string[] = [];
const slugs = new Set<string>();
const counts = { real: 0, ai: 0, A: { real: 0, ai: 0 }, B: { real: 0, ai: 0 } };
const byCategory: Record<string, { real: number; ai: number }> = {};

raw.forEach((entry, i) => {
  const parsed = itemInputSchema.safeParse(entry);
  if (!parsed.success) {
    errors.push(`#${i}: ${parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; ")}`);
    return;
  }
  const it = parsed.data;
  if (slugs.has(it.slug)) errors.push(`#${i}: duplicate slug ${it.slug}`);
  slugs.add(it.slug);
  const leak = it.slug.split("-").find((w) => LEAKY.has(w)) ?? it.mediaUrl.split(/[/._-]/).find((w) => LEAKY.has(w.toLowerCase()));
  if (leak) errors.push(`${it.slug}: slug or file name contains "${leak}", which hints at the answer`);
  const abs = path.join(root, "public", it.mediaUrl);
  if (!it.mediaUrl.startsWith("/media/")) errors.push(`${it.slug}: mediaUrl must start with /media/`);
  else if (!existsSync(abs)) errors.push(`${it.slug}: missing file public${it.mediaUrl}`);
  else if (it.mediaType === "image") {
    imageChecks.push(
      sharp(abs)
        .metadata()
        .then((m) => {
          if (m.width !== BUNDLED_WIDTH || m.height !== BUNDLED_HEIGHT) errors.push(`${it.slug}: image is ${m.width}×${m.height}, run scripts/normalize-media.ts`);
          if (it.width !== m.width || it.height !== m.height) errors.push(`${it.slug}: width/height in items.json do not match the file`);
          if (m.exif || m.xmp || m.iptc || m.icc) errors.push(`${it.slug}: image still carries metadata (EXIF/XMP/IPTC/ICC)`);
        }),
    );
  }
  if (it.label === "ai" && !it.generator) errors.push(`${it.slug}: AI items need a generator`);
  if (it.label === "real" && it.generator) errors.push(`${it.slug}: real items must have generator null`);
  counts[it.label]++;
  if (it.assessmentSet) counts[it.assessmentSet][it.label]++;
  byCategory[it.category] ??= { real: 0, ai: 0 };
  byCategory[it.category][it.label]++;
});

async function report() {
  await Promise.all(imageChecks);
  console.log(`items: ${raw.length}  real: ${counts.real}  ai: ${counts.ai}`);
  console.log(`assessment A: ${JSON.stringify(counts.A)}  B: ${JSON.stringify(counts.B)}`);
  console.log("by category:", JSON.stringify(byCategory));
  if (Math.abs(counts.real - counts.ai) > 2) errors.push("real/ai counts differ by more than 2");
  for (const set of ["A", "B"] as const) {
    if (counts[set].real !== 4 || counts[set].ai !== 4) errors.push(`assessment set ${set} must have exactly 4 real + 4 ai`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} problem(s):\n- ${errors.join("\n- ")}`);
    process.exit(1);
  }
  console.log("content OK");
}

void report();

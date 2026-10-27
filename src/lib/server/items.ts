/** Content library: admin CRUD, stats, and public credits. */
import { and, asc, count, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import type { AdminItemDTO, AdminStatsDTO, ItemInput, ItemStatus, Label, ReviewStatus } from "@/lib/contracts";
import { itemInputSchema } from "@/lib/contracts";
import { type Db, type Tx, schema } from "@/db/client";
import { HttpError, isUniqueViolation, notFound } from "./http";
import { isAllowedMediaUrl } from "./storage";

const { items, clues, answers, players, classrooms } = schema;
type ItemRow = typeof items.$inferSelect;

function assertConsistent(input: ItemInput): void {
  if (input.label === "ai" && !input.generator?.trim()) {
    throw new HttpError("validation_error", "AI-made items need the generator that made them", [{ path: "generator", message: "Required for AI-made items" }]);
  }
  if (input.label === "real" && input.generator) {
    throw new HttpError("validation_error", "Real items cannot have a generator", [{ path: "generator", message: "Must be empty for real items" }]);
  }
  if (!isAllowedMediaUrl(input.mediaUrl)) {
    throw new HttpError("validation_error", "Media must be uploaded through the studio", [{ path: "mediaUrl", message: "Upload the file first" }]);
  }
}

async function toDTOs(db: Db, rows: ItemRow[]): Promise<AdminItemDTO[]> {
  if (rows.length === 0) return [];
  const clueRows = await db
    .select()
    .from(clues)
    .where(
      inArray(
        clues.itemId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(clues.position));
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl,
    width: r.width,
    height: r.height,
    label: r.label,
    category: r.category,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    license: r.license,
    licenseUrl: r.licenseUrl,
    attribution: r.attribution,
    generator: r.generator,
    provenanceNote: r.provenanceNote,
    assessmentSet: r.assessmentSet,
    status: r.status,
    reviewStatus: r.reviewStatus,
    rating: Math.round(Number(r.rating)),
    timesShown: r.timesShown,
    timesCorrect: r.timesCorrect,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    clues: clueRows
      .filter((c) => c.itemId === r.id)
      .map((c) => ({ id: c.id, kind: c.kind, title: c.title, explanation: c.explanation, region: c.region ?? null })),
  }));
}

export type ItemFilters = { status?: ItemStatus; label?: Label; review?: ReviewStatus; q?: string };

export async function listItems(db: Db, f: ItemFilters): Promise<AdminItemDTO[]> {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(items.status, f.status));
  if (f.label) conds.push(eq(items.label, f.label));
  if (f.review) conds.push(eq(items.reviewStatus, f.review));
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    conds.push(or(ilike(items.slug, like), ilike(items.attribution, like), ilike(items.category, like))!);
  }
  const rows = await db
    .select()
    .from(items)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(items.updatedAt))
    .limit(500);
  return toDTOs(db, rows);
}

export async function getItem(db: Db, id: string): Promise<AdminItemDTO> {
  const [row] = await db.select().from(items).where(eq(items.id, id)).limit(1);
  if (!row) throw notFound("Item");
  return (await toDTOs(db, [row]))[0];
}

async function writeClues(tx: Tx, itemId: string, list: ItemInput["clues"]) {
  await tx.delete(clues).where(eq(clues.itemId, itemId));
  if (list.length) {
    await tx.insert(clues).values(list.map((c, position) => ({ itemId, position, kind: c.kind, title: c.title, explanation: c.explanation, region: c.region })));
  }
}

function columns(input: ItemInput) {
  const { clues: _clues, ...rest } = input;
  return { ...rest, generator: rest.generator?.trim() || null };
}

export async function createItem(db: Db, input: ItemInput): Promise<AdminItemDTO> {
  assertConsistent(input);
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx.insert(items).values(columns(input)).returning({ id: items.id });
      await writeClues(tx, row.id, input.clues);
      return row.id;
    });
    return getItem(db, id);
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError("conflict", "An item with this slug already exists");
    throw err;
  }
}

export async function updateItem(db: Db, id: string, patch: Partial<ItemInput>): Promise<AdminItemDTO> {
  const current = await getItem(db, id);
  const { id: _id, rating: _r, timesShown: _s, timesCorrect: _c, createdAt: _a, updatedAt: _u, ...editable } = current;
  // Validate the merged result so a partial update can never leave an invalid item.
  const merged = itemInputSchema.parse({ ...editable, clues: current.clues.map(({ id: _cid, ...c }) => c), ...patch });
  assertConsistent(merged);
  try {
    await db.transaction(async (tx) => {
      await tx
        .update(items)
        .set({ ...columns(merged), updatedAt: new Date() })
        .where(eq(items.id, id));
      if (patch.clues) await writeClues(tx, id, merged.clues);
      // Correcting a wrong answer key re-scores past answers so stats stay truthful.
      if (merged.label !== current.label) {
        await tx
          .update(answers)
          .set({
            correct: sql`${answers.guess} = ${merged.label}`,
            points: sql`case when ${answers.guess} = ${merged.label} then ${answers.confidence} else 50 - ${answers.confidence} end`,
          })
          .where(eq(answers.itemId, id));
        await tx
          .update(items)
          .set({ timesCorrect: sql`(select count(*) from ${answers} where ${answers.itemId} = ${id} and ${answers.correct})` })
          .where(eq(items.id, id));
      }
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new HttpError("conflict", "An item with this slug already exists");
    throw err;
  }
  return getItem(db, id);
}

/** Items are archived, never deleted: answers keep referring to them. */
export async function archiveItem(db: Db, id: string): Promise<void> {
  const res = await db.update(items).set({ status: "archived", updatedAt: new Date() }).where(eq(items.id, id)).returning({ id: items.id });
  if (res.length === 0) throw notFound("Item");
}

export async function adminStats(db: Db): Promise<AdminStatsDTO> {
  const [it] = await db
    .select({
      total: sql<number>`count(*)::int`,
      published: sql<number>`count(*) filter (where ${items.status} = 'published')::int`,
      real: sql<number>`count(*) filter (where ${items.label} = 'real' and ${items.status} = 'published')::int`,
      ai: sql<number>`count(*) filter (where ${items.label} = 'ai' and ${items.status} = 'published')::int`,
      needsReview: sql<number>`count(*) filter (where ${items.reviewStatus} = 'ai_draft' and ${items.status} <> 'archived')::int`,
    })
    .from(items);
  const [p] = await db.select({ n: count() }).from(players);
  const [a] = await db.select({ n: count() }).from(answers);
  const [c] = await db.select({ n: count() }).from(classrooms);
  return {
    items: { total: Number(it.total), published: Number(it.published), real: Number(it.real), ai: Number(it.ai), needsReview: Number(it.needsReview) },
    players: Number(p.n),
    answers: Number(a.n),
    classrooms: Number(c.n),
  };
}

export async function credits(db: Db) {
  const rows = await db
    .selectDistinct({ author: items.attribution, license: items.license, licenseUrl: items.licenseUrl, sourceUrl: items.sourceUrl })
    .from(items)
    .where(eq(items.status, "published"))
    .orderBy(asc(items.attribution), asc(items.sourceUrl));
  return rows;
}

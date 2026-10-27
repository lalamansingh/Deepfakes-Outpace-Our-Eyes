"use client";

import clsx from "clsx";
import { Archive, ArrowLeft, BadgeCheck, Crosshair, Eraser, ImagePlus, Plus, Save, SquareDashed, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import {
  CATEGORIES,
  CLUE_KINDS,
  ITEM_STATUSES,
  LABELS,
  REVIEW_STATUSES,
  itemInputSchema,
  type AdminItemDTO,
  type Category,
  type ClueKind,
  type ItemInput,
  type ItemStatus,
  type Label,
  type MediaType,
  type Region,
  type ReviewStatus,
} from "@/lib/contracts";
import { Button, Card, ErrorNote, Spinner, percent } from "@/components/ui";
import { LabelBadge, ReviewBadge, StatusBadge } from "./bits";
import { ConfirmDialog } from "./dialog";
import { formatDate } from "./format";
import { SelectField, TextAreaField, TextField, toFieldErrors, type FieldErrors } from "./form";
import { CATEGORY_LABELS, CLUE_KIND_LABELS, REVIEW_LABELS, STATUS_LABELS } from "./labels";
import { RegionCanvas } from "./region-editor";
import { PageHeader } from "./shell";

const MAX_CLUES = 8;

type ClueDraft = { key: string; kind: ClueKind; title: string; explanation: string; region: Region | null };

type Draft = {
  slug: string;
  mediaType: MediaType;
  mediaUrl: string;
  width: number | null;
  height: number | null;
  label: Label;
  category: Category;
  generator: string;
  sourceName: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  provenanceNote: string;
  assessmentSet: "" | "A" | "B";
  status: ItemStatus;
  reviewStatus: ReviewStatus;
  clues: ClueDraft[];
};

type UploadResult = { url: string; mediaType: MediaType; width: number | null; height: number | null };

let keySeq = 0;
const newKey = () => `clue-${++keySeq}`;

const emptyClue = (): ClueDraft => ({ key: newKey(), kind: "lighting", title: "", explanation: "", region: null });

const emptyDraft = (): Draft => ({
  slug: "",
  mediaType: "image",
  mediaUrl: "",
  width: null,
  height: null,
  label: "ai",
  category: "portrait",
  generator: "",
  sourceName: "",
  sourceUrl: "",
  license: "",
  licenseUrl: "",
  attribution: "",
  provenanceNote: "",
  assessmentSet: "",
  status: "draft",
  reviewStatus: "ai_draft",
  clues: [emptyClue()],
});

function draftFromItem(item: AdminItemDTO): Draft {
  return {
    slug: item.slug,
    mediaType: item.mediaType,
    mediaUrl: item.mediaUrl,
    width: item.width,
    height: item.height,
    label: item.label,
    category: item.category,
    generator: item.generator ?? "",
    sourceName: item.sourceName,
    sourceUrl: item.sourceUrl,
    license: item.license,
    licenseUrl: item.licenseUrl ?? "",
    attribution: item.attribution,
    provenanceNote: item.provenanceNote,
    assessmentSet: item.assessmentSet ?? "",
    status: item.status,
    reviewStatus: item.reviewStatus,
    clues: item.clues.map((c) => ({ key: newKey(), kind: c.kind, title: c.title, explanation: c.explanation, region: c.region })),
  };
}

function toInput(d: Draft) {
  const trimmedOrNull = (s: string) => (s.trim() ? s.trim() : null);
  return {
    slug: d.slug,
    mediaType: d.mediaType,
    mediaUrl: d.mediaUrl,
    width: d.width,
    height: d.height,
    label: d.label,
    category: d.category,
    generator: d.label === "real" ? null : trimmedOrNull(d.generator),
    sourceName: d.sourceName,
    sourceUrl: d.sourceUrl,
    license: d.license,
    licenseUrl: trimmedOrNull(d.licenseUrl),
    attribution: d.attribution,
    provenanceNote: d.provenanceNote,
    assessmentSet: d.assessmentSet || null,
    status: d.status,
    reviewStatus: d.reviewStatus,
    clues: d.clues.map(({ kind, title, explanation, region }) => ({ kind, title, explanation, region })),
  };
}

/** Validates with the shared schema plus the generator rule the schema cannot express. */
function validate(d: Draft): { ok: true; data: ItemInput } | { ok: false; errors: FieldErrors } {
  const parsed = itemInputSchema.safeParse(toInput(d));
  const errors: FieldErrors = parsed.success ? {} : toFieldErrors(parsed.error);
  if (d.label === "ai" && !d.generator.trim()) errors.generator = "Name the tool that made it. Required for AI-made items.";
  if (!d.mediaUrl.trim()) errors.mediaUrl = "Upload an image, audio or video file first.";
  if (parsed.success && Object.keys(errors).length === 0) return { ok: true, data: parsed.data };
  return { ok: false, errors };
}

/** Maps a server validation_error's details (`[{ path, message }]`) onto field errors, first message per field. */
function serverFieldErrors(details: unknown): FieldErrors {
  if (!Array.isArray(details)) return {};
  const out: FieldErrors = {};
  for (const d of details) {
    if (d && typeof d === "object" && typeof d.path === "string" && typeof d.message === "string" && d.path && !out[d.path]) {
      out[d.path] = d.message;
    }
  }
  return out;
}

const opts = <T extends string>(values: readonly T[], labels: Record<T, string>) => values.map((v) => ({ value: v, label: labels[v] }));
const LABEL_OPTIONS = LABELS.map((l) => ({ value: l, label: l === "ai" ? "AI-made" : "Real" }));
const ASSESSMENT_OPTIONS = [
  { value: "", label: "None (regular pool)" },
  { value: "A", label: "Set A (pre-assessment)" },
  { value: "B", label: "Set B (post-assessment)" },
];

function Section({ title, description, children, id }: { title: string; description?: ReactNode; children: ReactNode; id: string }) {
  return (
    <Card>
      <section aria-labelledby={id}>
        <h2 id={id} className="text-base font-bold text-ink">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </section>
    </Card>
  );
}

function MediaPreview({
  draft,
  selected,
  onSelect,
  onDraw,
}: {
  draft: Draft;
  selected: number | null;
  onSelect: (i: number) => void;
  onDraw: (r: Region) => void;
}) {
  if (!draft.mediaUrl) {
    return (
      <div className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-line bg-tint/50 p-6 text-center text-sm text-muted">
        <div>
          <ImagePlus className="mx-auto size-8 text-wine" aria-hidden />
          <p className="mt-2">Upload a file to see a preview and draw clue regions.</p>
        </div>
      </div>
    );
  }
  if (draft.mediaType === "image") {
    return (
      <RegionCanvas
        src={draft.mediaUrl}
        alt={`Preview of ${draft.slug || "the new item"}`}
        regions={draft.clues.map((c) => c.region)}
        selected={selected}
        onSelect={onSelect}
        onDraw={onDraw}
      />
    );
  }
  if (draft.mediaType === "audio") {
    return (
      <div className="rounded-xl border border-line bg-tint/50 p-4">
        <audio src={draft.mediaUrl} controls className="w-full" preload="metadata">
          Your browser cannot play this audio.
        </audio>
      </div>
    );
  }
  return (
    <video src={draft.mediaUrl} controls className="w-full rounded-xl border border-line bg-plum" preload="metadata">
      Your browser cannot play this video.
    </video>
  );
}

function RegionFields({
  index,
  region,
  error,
  onChange,
}: {
  index: number;
  region: Region | null;
  error?: string;
  onChange: (r: Region | null) => void;
}) {
  const errorId = useId();
  if (!region) return null;
  const set = (key: keyof Region) => (e: ChangeEvent<HTMLInputElement>) => {
    const v = e.target.valueAsNumber;
    if (!Number.isNaN(v)) onChange({ ...region, [key]: Math.round(v * 1000) / 1000 });
  };
  const fields: { key: keyof Region; label: string }[] = [
    { key: "x", label: "Left (x)" },
    { key: "y", label: "Top (y)" },
    { key: "w", label: "Width (w)" },
    { key: "h", label: "Height (h)" },
  ];
  return (
    <fieldset className="mt-3" aria-describedby={error ? errorId : undefined}>
      <legend className="text-xs font-semibold text-muted">Region of clue {index + 1}, as fractions of the image (0–1)</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fields.map((f) => (
          <label key={f.key} className="flex flex-col gap-1 text-xs text-muted">
            {f.label}
            <input
              type="number"
              inputMode="decimal"
              min={0}
              max={1}
              step={0.01}
              value={region[f.key]}
              onChange={set(f.key)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="w-full rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm tabular-nums text-ink focus:border-wine focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ora aria-[invalid=true]:border-wine"
            />
          </label>
        ))}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs font-medium text-wine">
          {error}
        </p>
      )}
    </fieldset>
  );
}

function regionError(errors: FieldErrors, i: number) {
  const key = Object.keys(errors).find((k) => k.startsWith(`clues.${i}.region`));
  return key ? errors[key] : undefined;
}

export function ItemEditor({ id }: { id?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const isNew = !id;
  const [item, setItem] = useState<AdminItemDTO | null>(null);
  const [draft, setDraft] = useState<Draft | null>(isNew ? emptyDraft() : null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(params.get("created") ? "Item created." : null);
  const [busy, setBusy] = useState<null | "save" | "review" | "archive" | "upload">(null);
  const [selected, setSelected] = useState<number | null>(0);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api
      .get<AdminItemDTO>(`/api/admin/items/${encodeURIComponent(id)}`)
      .then((it) => {
        setItem(it);
        setDraft(draftFromItem(it));
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof ApiClientError && err.status === 404 ? "This item doesn't exist." : err instanceof Error ? err.message : "Could not load the item.");
      });
  }, [id]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const back = (
    <Link href="/admin/items" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted hover:text-wine">
      <ArrowLeft className="size-4" aria-hidden /> Content library
    </Link>
  );

  if (loadError)
    return (
      <>
        <PageHeader title="Edit item" back={back} />
        <ErrorNote>{loadError}</ErrorNote>
      </>
    );
  if (!draft) return <Spinner label="Loading item" />;

  const update = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const updateClue = (i: number, patch: Partial<ClueDraft>) =>
    setDraft((d) => (d ? { ...d, clues: d.clues.map((c, j) => (j === i ? { ...c, ...patch } : c)) } : d));
  const text = (key: "slug" | "generator" | "sourceName" | "sourceUrl" | "license" | "licenseUrl" | "attribution" | "provenanceNote") => ({
    value: draft[key],
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, e.target.value),
    error: errors[key],
  });

  const focusFirstError = () =>
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());

  const onUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    setBusy("upload");
    setServerError(null);
    try {
      const up = await api.post<UploadResult>("/api/admin/uploads", body);
      setDraft((d) => (d ? { ...d, mediaUrl: up.url, mediaType: up.mediaType, width: up.width, height: up.height } : d));
      setErrors((prev) => {
        const next = { ...prev };
        delete next.mediaUrl;
        return next;
      });
    } catch (err) {
      setErrors((prev) => ({ ...prev, mediaUrl: err instanceof Error ? err.message : "Upload failed." }));
    } finally {
      setBusy(null);
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setNotice(null);
    const result = validate(draft);
    if (!result.ok) {
      setErrors(result.errors);
      focusFirstError();
      return;
    }
    setErrors({});
    setBusy("save");
    try {
      if (!id) {
        const created = await api.post<AdminItemDTO>("/api/admin/items", result.data);
        router.replace(`/admin/items/${created.id}?created=1`);
        return;
      }
      const saved = await api.patch<AdminItemDTO>(`/api/admin/items/${encodeURIComponent(id)}`, result.data);
      setItem(saved);
      setDraft(draftFromItem(saved));
      setNotice("Changes saved.");
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setErrors({ slug: "Another item already uses this slug." });
        focusFirstError();
      } else if (err instanceof ApiClientError && err.status === 400) {
        const fe = serverFieldErrors(err.details);
        setErrors(fe);
        setServerError(err.message);
        if (Object.keys(fe).length) focusFirstError();
      } else {
        setServerError(err instanceof Error ? err.message : "Could not save the item.");
      }
    }
    setBusy(null);
  };

  const onMarkReviewed = async () => {
    if (!id) return;
    setBusy("review");
    setServerError(null);
    try {
      const saved = await api.patch<AdminItemDTO>(`/api/admin/items/${encodeURIComponent(id)}`, { reviewStatus: "reviewed" });
      setItem(saved);
      update("reviewStatus", "reviewed");
      setNotice("Marked as reviewed.");
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not update the review status.");
    }
    setBusy(null);
  };

  const onArchive = async () => {
    if (!id) return;
    setBusy("archive");
    try {
      await api.del(`/api/admin/items/${encodeURIComponent(id)}`);
      router.push("/admin/items");
    } catch (err) {
      setConfirmArchive(false);
      setServerError(err instanceof Error ? err.message : "Could not archive the item.");
      setBusy(null);
    }
  };

  const addClue = () => {
    setDraft((d) => (d && d.clues.length < MAX_CLUES ? { ...d, clues: [...d.clues, emptyClue()] } : d));
    setSelected(draft.clues.length);
  };
  const removeClue = (i: number) => {
    setDraft((d) => (d ? { ...d, clues: d.clues.filter((_, j) => j !== i) } : d));
    setSelected((s) => (s === null ? s : s === i ? null : s > i ? s - 1 : s));
    setErrors({});
  };

  const errorCount = Object.keys(errors).length;
  const isImage = draft.mediaType === "image" && Boolean(draft.mediaUrl);

  return (
    <>
      <PageHeader
        eyebrow="Content studio"
        title={isNew ? "New item" : item?.slug ?? draft.slug}
        back={back}
        description={
          item ? (
            <span className="inline-flex flex-wrap items-center gap-2">
              <LabelBadge label={item.label} />
              <StatusBadge status={item.status} />
              <ReviewBadge review={item.reviewStatus} />
              <span className="text-xs text-subtle">Updated {formatDate(item.updatedAt)}</span>
            </span>
          ) : (
            "Upload the media, describe what gives it away, and record exactly where it came from."
          )
        }
        actions={
          item && (
            <>
              {item.reviewStatus !== "reviewed" && (
                <Button type="button" variant="outline" onClick={onMarkReviewed} disabled={busy !== null} className="py-2.5">
                  <BadgeCheck className="size-4" aria-hidden />
                  {busy === "review" ? "Saving…" : "Mark reviewed"}
                </Button>
              )}
              {item.status !== "archived" && (
                <Button type="button" variant="ghost" onClick={() => setConfirmArchive(true)} disabled={busy !== null} className="py-2.5">
                  <Archive className="size-4" aria-hidden /> Archive
                </Button>
              )}
            </>
          )
        }
      />

      <div aria-live="polite" className="sr-only">
        {notice}
      </div>
      {notice && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-plum-3/20 bg-white px-4 py-3 text-sm font-medium text-plum-3">
          <BadgeCheck className="size-4 text-wine" aria-hidden /> {notice}
        </p>
      )}
      {serverError && (
        <div className="mb-4">
          <ErrorNote>{serverError}</ErrorNote>
        </div>
      )}
      {errorCount > 0 && !serverError && (
        <div className="mb-4">
          <ErrorNote>
            {errorCount === 1 ? "One field needs attention" : `${errorCount} fields need attention`} before this item can be saved.
          </ErrorNote>
        </div>
      )}

      {item && (
        <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { k: "Difficulty rating", v: Math.round(item.rating).toString() },
            { k: "Times shown", v: item.timesShown.toString() },
            { k: "Success rate", v: item.timesShown ? percent(item.timesCorrect / item.timesShown) : "—" },
            { k: "Created", v: formatDate(item.createdAt) },
          ].map((s) => (
            <div key={s.k} className="rounded-2xl border border-line bg-white px-4 py-3">
              <dt className="text-xs font-medium text-muted">{s.k}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{s.v}</dd>
            </div>
          ))}
        </dl>
      )}

      <form ref={formRef} onSubmit={onSave} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        {/* Media column: sticky on wide screens so regions can be drawn while editing clues. */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <Section id="media-title" title="Media" description="JPEG, PNG or WebP up to 8 MB · MP3, M4A, OGG or WAV up to 15 MB · MP4 or WebM up to 40 MB.">
            <MediaPreview
              draft={draft}
              selected={selected}
              onSelect={setSelected}
              onDraw={(r) => selected !== null && updateClue(selected, { region: r })}
            />
            {isImage && (
              <p className="mt-3 flex items-start gap-2 text-xs text-muted">
                <Crosshair className="mt-0.5 size-3.5 shrink-0 text-wine" aria-hidden />
                {selected !== null && draft.clues[selected]
                  ? `Drag on the image to set the region for clue ${selected + 1}. Tap a numbered box to select that clue.`
                  : "Select a clue below, then drag on the image to mark its region."}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                id="media-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,audio/mpeg,audio/mp4,audio/x-m4a,audio/ogg,audio/wav,video/mp4,video/webm"
                onChange={onUpload}
                className="sr-only"
                aria-describedby={errors.mediaUrl ? "media-error" : undefined}
                aria-invalid={Boolean(errors.mediaUrl)}
              />
              <Button type="button" variant="outline" className="py-2.5" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
                <Upload className="size-4" aria-hidden />
                {busy === "upload" ? "Uploading…" : draft.mediaUrl ? "Replace file" : "Upload file"}
              </Button>
              {draft.mediaUrl && (
                <p className="min-w-0 truncate text-xs text-muted">
                  <span className="font-semibold capitalize text-ink">{draft.mediaType}</span>
                  {draft.width && draft.height ? ` · ${draft.width}×${draft.height}` : ""} · <span className="font-mono">{draft.mediaUrl}</span>
                </p>
              )}
            </div>
            {errors.mediaUrl && (
              <p id="media-error" className="mt-2 text-xs font-medium text-wine">
                {errors.mediaUrl}
              </p>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section id="basics-title" title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Slug" required {...text("slug")} hint="Lowercase letters, digits and dashes, e.g. cat-on-sofa-ai." className="sm:col-span-2" />
              <SelectField
                label="Label"
                required
                options={LABEL_OPTIONS}
                value={draft.label}
                onChange={(e) => {
                  const label = e.target.value as Label;
                  setDraft((d) => (d ? { ...d, label, generator: label === "real" ? "" : d.generator } : d));
                }}
                hint="The true answer players are scored against."
              />
              <SelectField
                label="Category"
                required
                options={opts(CATEGORIES, CATEGORY_LABELS)}
                value={draft.category}
                onChange={(e) => update("category", e.target.value as Category)}
              />
              <TextField
                label="Generator"
                required={draft.label === "ai"}
                disabled={draft.label === "real"}
                placeholder={draft.label === "real" ? "Not applicable to real media" : "e.g. Midjourney v6, ElevenLabs"}
                hint={draft.label === "real" ? "Real media has no generator, so this stays empty." : "The tool or model that created this item."}
                {...text("generator")}
              />
              <SelectField
                label="Assessment set"
                options={ASSESSMENT_OPTIONS}
                value={draft.assessmentSet}
                onChange={(e) => update("assessmentSet", e.target.value as Draft["assessmentSet"])}
                hint="Fixed sets for the pre and post assessments."
              />
            </div>
          </Section>

          <Section
            id="clues-title"
            title={`Clues (${draft.clues.length}/${MAX_CLUES})`}
            description="What should players notice? Explain it in plain words. Visual clues get a region on the image; source and context clues don't need one."
          >
            {errors.clues && <p className="mb-3 text-xs font-medium text-wine">{errors.clues}</p>}
            <ol className="space-y-4">
              {draft.clues.map((clue, i) => {
                const isSel = selected === i;
                return (
                  <li
                    key={clue.key}
                    className={clsx("rounded-2xl border p-4 transition", isSel ? "border-ora bg-ora-tint/50" : "border-line bg-white")}
                    onFocusCapture={() => setSelected(i)}
                    aria-label={`Clue ${i + 1}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold text-ink">
                        <span aria-hidden className={clsx("grid size-6 place-items-center rounded-md text-xs", isSel ? "bg-ora text-plum" : "bg-wine text-white")}>
                          {i + 1}
                        </span>
                        Clue {i + 1}
                        {isSel && isImage && <span className="text-xs font-medium text-ora-deep">· drawing target</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeClue(i)}
                        disabled={draft.clues.length <= 1}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-tint hover:text-wine disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove clue ${i + 1}`}
                      >
                        <Trash2 className="size-3.5" aria-hidden /> Remove
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label="Kind"
                        options={opts(CLUE_KINDS, CLUE_KIND_LABELS)}
                        value={clue.kind}
                        onChange={(e) => updateClue(i, { kind: e.target.value as ClueKind })}
                        error={errors[`clues.${i}.kind`]}
                      />
                      <TextField
                        label="Title"
                        required
                        placeholder="e.g. Six fingers on the left hand"
                        value={clue.title}
                        onChange={(e) => updateClue(i, { title: e.target.value })}
                        error={errors[`clues.${i}.title`]}
                      />
                      <TextAreaField
                        label="Explanation"
                        required
                        className="sm:col-span-2"
                        rows={3}
                        value={clue.explanation}
                        onChange={(e) => updateClue(i, { explanation: e.target.value })}
                        error={errors[`clues.${i}.explanation`]}
                        hint={`${clue.explanation.trim().length}/400 characters`}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {clue.region ? (
                        <>
                          {isImage && (
                            <button
                              type="button"
                              onClick={() => setSelected(i)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-wine hover:bg-tint"
                            >
                              <Crosshair className="size-3.5" aria-hidden /> Redraw on image
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => updateClue(i, { region: null })}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-tint hover:text-wine"
                          >
                            <Eraser className="size-3.5" aria-hidden /> Clear region
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted">No region — fine for source, context and audio clues.</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(i);
                              updateClue(i, { region: { x: 0.25, y: 0.25, w: 0.5, h: 0.5 } });
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-semibold text-wine hover:bg-tint"
                          >
                            <SquareDashed className="size-3.5" aria-hidden /> Add region
                          </button>
                        </>
                      )}
                    </div>
                    <RegionFields index={i} region={clue.region} error={regionError(errors, i)} onChange={(r) => updateClue(i, { region: r })} />
                  </li>
                );
              })}
            </ol>
            <Button type="button" variant="ghost" onClick={addClue} disabled={draft.clues.length >= MAX_CLUES} className="mt-4 py-2.5">
              <Plus className="size-4" aria-hidden /> Add clue
            </Button>
          </Section>

          <Section id="source-title" title="Source & licence" description="Shown to players after they answer and on the credits page. Be precise.">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Source name" required {...text("sourceName")} placeholder="e.g. Wikimedia Commons" />
              <TextField label="Source URL" required type="url" inputMode="url" {...text("sourceUrl")} placeholder="https://" />
              <TextField label="Licence" required {...text("license")} placeholder="e.g. CC BY-SA 4.0" />
              <TextField label="Licence URL" type="url" inputMode="url" {...text("licenseUrl")} placeholder="https://" hint="Optional." />
              <TextField label="Attribution" required {...text("attribution")} className="sm:col-span-2" placeholder="e.g. Photo by Jane Doe" />
              <TextAreaField
                label="Provenance note"
                required
                {...text("provenanceNote")}
                className="sm:col-span-2"
                rows={3}
                hint="How we know whether it is real or AI-made (e.g. original upload date, prompt, generator metadata)."
              />
            </div>
          </Section>

          <Section id="publishing-title" title="Publishing">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Status"
                options={opts(ITEM_STATUSES, STATUS_LABELS)}
                value={draft.status}
                onChange={(e) => update("status", e.target.value as ItemStatus)}
                hint="Only published items appear in rounds."
              />
              <SelectField
                label="Review"
                options={opts(REVIEW_STATUSES, REVIEW_LABELS)}
                value={draft.reviewStatus}
                onChange={(e) => update("reviewStatus", e.target.value as ReviewStatus)}
                hint="Mark reviewed once a person has checked the clues."
              />
            </div>
          </Section>

          <div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
            <Link href="/admin/items" className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-wine">
              Cancel
            </Link>
            <Button type="submit" variant="wine" disabled={busy !== null}>
              <Save className="size-4" aria-hidden />
              {busy === "save" ? "Saving…" : isNew ? "Create item" : "Save changes"}
            </Button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={confirmArchive}
        title="Archive this item?"
        confirmLabel="Archive item"
        busy={busy === "archive"}
        onConfirm={onArchive}
        onCancel={() => setConfirmArchive(false)}
      >
        <p>
          <span className="font-semibold text-ink">{item?.slug}</span> will be removed from all future rounds. Answers already given are kept, and
          you can publish it again later by changing its status.
        </p>
      </ConfirmDialog>
    </>
  );
}

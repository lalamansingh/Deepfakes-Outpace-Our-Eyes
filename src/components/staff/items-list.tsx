"use client";

import clsx from "clsx";
import { ImageOff, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/api-client";
import { ITEM_STATUSES, LABELS, REVIEW_STATUSES, type AdminItemDTO } from "@/lib/contracts";
import { ButtonLink, Card, ErrorNote, Spinner, percent } from "@/components/ui";
import { EmptyState, LabelBadge, ReviewBadge, StatusBadge } from "./bits";
import { SelectField, TextField } from "./form";
import { CATEGORY_LABELS, REVIEW_LABELS, STATUS_LABELS } from "./labels";
import { MediaThumb } from "./media";
import { PageHeader } from "./shell";

const FILTERS = {
  status: [{ value: "", label: "All statuses" }, ...ITEM_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))],
  label: [{ value: "", label: "Real and AI" }, ...LABELS.map((l) => ({ value: l, label: l === "ai" ? "AI-made" : "Real" }))],
  review: [{ value: "", label: "Any review state" }, ...REVIEW_STATUSES.map((r) => ({ value: r, label: REVIEW_LABELS[r] }))],
} as const;

type FilterKey = keyof typeof FILTERS | "q";

export function ItemsList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params.toString();
  const [result, setResult] = useState<{ query: string; items: AdminItemDTO[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .get<{ items: AdminItemDTO[] }>(`/api/admin/items${query ? `?${query}` : ""}`)
      .then((r) => {
        if (!cancelled) setResult({ query, items: r.items });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load items.");
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  const setFilter = (key: FilterKey, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    setFilter("q", q.trim());
  };

  const loading = !error && result?.query !== query;
  const items = result?.items ?? [];
  const filtered = query.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Content studio"
        title="Content library"
        description="Every real and AI-made item, with its clues and provenance."
        actions={
          <ButtonLink href="/admin/items/new" variant="wine">
            <Plus className="size-4" aria-hidden /> New item
          </ButtonLink>
        }
      />

      <Card className="mb-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
          <form role="search" onSubmit={onSearch} className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
            <TextField
              label="Search"
              type="search"
              placeholder="Slug, source, generator…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="flex-1"
            />
            <button
              type="submit"
              aria-label="Search items"
              className="grid size-[42px] shrink-0 place-items-center rounded-xl bg-wine text-white transition hover:brightness-110"
            >
              <Search className="size-4" aria-hidden />
            </button>
          </form>
          <SelectField label="Status" options={FILTERS.status} value={params.get("status") ?? ""} onChange={(e) => setFilter("status", e.target.value)} />
          <SelectField label="Label" options={FILTERS.label} value={params.get("label") ?? ""} onChange={(e) => setFilter("label", e.target.value)} />
          <SelectField label="Review" options={FILTERS.review} value={params.get("review") ?? ""} onChange={(e) => setFilter("review", e.target.value)} />
        </div>
      </Card>

      {error && <ErrorNote>{error}</ErrorNote>}
      {!error && !result && <Spinner label="Loading items" />}
      {result && items.length === 0 && !loading && (
        <EmptyState icon={ImageOff} title={filtered ? "No items match these filters" : "The library is empty"}>
          {filtered ? (
            <button type="button" onClick={() => router.replace(pathname)} className="font-semibold text-wine hover:underline">
              Clear all filters
            </button>
          ) : (
            "Add the first item: upload a real photo or an AI-made image, voice or video with its clues and source."
          )}
        </EmptyState>
      )}
      {result && items.length > 0 && (
        <Card className={clsx("p-0 transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          <div className="flex items-center justify-between px-5 pt-4 text-sm text-muted">
            <p aria-live="polite">
              {items.length} {items.length === 1 ? "item" : "items"}
            </p>
            {loading && <Spinner label="Updating" />}
          </div>
          <div className="relative mt-2 overflow-x-auto">
            <table className="w-full min-w-[56rem] border-collapse text-sm">
              <caption className="sr-only">Content library items</caption>
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Label
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Review
                  </th>
                  <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                    Success rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-line/70 last:border-0 hover:bg-tint/40">
                    <th scope="row" className="px-5 py-3 text-left font-normal">
                      <div className="flex items-center gap-3">
                        <MediaThumb mediaType={item.mediaType} mediaUrl={item.mediaUrl} alt="" className="size-12 shrink-0" />
                        <div className="min-w-0">
                          <Link href={`/admin/items/${item.id}`} className="font-semibold text-ink hover:text-wine hover:underline">
                            {item.slug}
                          </Link>
                          <p className="truncate text-xs text-muted">
                            {item.mediaType} · {item.clues.length} {item.clues.length === 1 ? "clue" : "clues"}
                            {item.assessmentSet ? ` · assessment ${item.assessmentSet}` : ""}
                          </p>
                        </div>
                      </div>
                    </th>
                    <td className="px-3 py-3">
                      <LabelBadge label={item.label} />
                    </td>
                    <td className="px-3 py-3 text-muted">{CATEGORY_LABELS[item.category]}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-3 py-3">
                      <ReviewBadge review={item.reviewStatus} />
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      {item.timesShown > 0 ? (
                        <>
                          <span className="font-semibold text-ink">{percent(item.timesCorrect / item.timesShown)}</span>
                          <span className="block text-xs text-muted">of {item.timesShown} plays</span>
                        </>
                      ) : (
                        <span className="text-subtle">Not played</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}

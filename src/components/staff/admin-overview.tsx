"use client";

import { ArrowRight, Bot, Camera, CheckCircle2, Images, MessageSquareWarning, Plus, School, Users, Vote } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { AdminStatsDTO } from "@/lib/contracts";
import { ButtonLink, ErrorNote, Spinner } from "@/components/ui";
import { KpiTile } from "./bits";
import { PageHeader } from "./shell";

const nf = new Intl.NumberFormat("en-GB");

export function AdminOverview() {
  const [stats, setStats] = useState<AdminStatsDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<AdminStatsDTO>("/api/admin/stats")
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load stats."));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Content studio"
        title="Overview"
        description="The health of the content library and how much it is being played."
        actions={
          <ButtonLink href="/admin/items/new" variant="wine">
            <Plus className="size-4" aria-hidden /> New item
          </ButtonLink>
        }
      />
      {error && <ErrorNote>{error}</ErrorNote>}
      {!error && !stats && <Spinner label="Loading stats" />}
      {stats && (
        <div className="space-y-8">
          <section aria-labelledby="library-title">
            <h2 id="library-title" className="mb-3 text-base font-bold">
              Library
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <KpiTile icon={Images} label="Items in total" value={nf.format(stats.items.total)} />
              <KpiTile
                icon={CheckCircle2}
                label="Published"
                value={nf.format(stats.items.published)}
                detail={stats.items.total ? `${Math.round((stats.items.published / stats.items.total) * 100)}% of the library is live.` : undefined}
              />
              <KpiTile
                icon={MessageSquareWarning}
                tone="ora"
                label="Needs review"
                value={nf.format(stats.items.needsReview)}
                detail="AI-drafted clues that a human has not checked yet."
              />
              <KpiTile icon={Camera} label="Real items" value={nf.format(stats.items.real)} />
              <KpiTile icon={Bot} tone="ora" label="AI-made items" value={nf.format(stats.items.ai)} />
              <BalanceTile real={stats.items.real} ai={stats.items.ai} />
            </div>
          </section>
          <section aria-labelledby="usage-title">
            <h2 id="usage-title" className="mb-3 text-base font-bold">
              Usage
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <KpiTile icon={Users} label="Players" value={nf.format(stats.players)} />
              <KpiTile icon={Vote} label="Answers" value={nf.format(stats.answers)} />
              <KpiTile icon={School} label="Classrooms" value={nf.format(stats.classrooms)} />
            </div>
          </section>
          <section aria-labelledby="shortcuts-title">
            <h2 id="shortcuts-title" className="mb-3 text-base font-bold">
              Shortcuts
            </h2>
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                { href: "/admin/items?review=ai_draft", label: "Review AI-drafted items", body: "Check clue wording and regions." },
                { href: "/admin/items?status=draft", label: "Finish drafts", body: "Items not yet visible to players." },
                { href: "/admin/items", label: "Browse the library", body: "Search, filter and edit everything." },
              ].map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group flex h-full items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:border-wine/40">
                    <span>
                      <span className="block text-sm font-semibold text-ink group-hover:text-wine">{l.label}</span>
                      <span className="mt-1 block text-sm text-muted">{l.body}</span>
                    </span>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-wine" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </>
  );
}

/** Real vs AI split as one stacked bar; balance matters so guessing "AI" never pays. */
function BalanceTile({ real, ai }: { real: number; ai: number }) {
  const total = real + ai;
  const realPct = total ? Math.round((real / total) * 100) : 0;
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-white p-5">
      <p className="text-sm font-medium text-muted">Real / AI balance</p>
      <p className="mt-4 text-3xl font-bold leading-none tracking-tight text-ink">
        {total ? `${realPct} / ${100 - realPct}` : "—"}
      </p>
      <div
        className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-tint"
        role="img"
        aria-label={total ? `${realPct}% real, ${100 - realPct}% AI-made` : "No items yet"}
      >
        {total > 0 && (
          <>
            <div className="h-full bg-plum-3" style={{ width: `${realPct}%` }} />
            <div className="h-full flex-1 bg-gradient-ora" />
          </>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">Aim for roughly half and half so that always guessing one way never pays off.</p>
    </div>
  );
}

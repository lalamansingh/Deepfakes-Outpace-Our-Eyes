"use client";

import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, ClipboardCheck, Flame, Gauge, LineChart, Lock, Target, Users } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import type { ClassDashboardDTO } from "@/lib/contracts";
import { Card, ErrorNote, Spinner, percent } from "@/components/ui";
import { EmptyState, KpiTile, SectionTitle } from "./bits";
import { AccuracyLineChart, ClueTypeBars, PrePostBars } from "./charts";
import { CopyButton } from "./copy-button";
import { describeGap, formatGap, formatRelative } from "./format";
import { PageHeader } from "./shell";

type Student = ClassDashboardDTO["students"][number];
type SortKey = "nickname" | "answered" | "accuracy" | "calibrationGap" | "streak" | "lastActive";

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
  { key: "nickname", label: "Nickname", numeric: false },
  { key: "answered", label: "Answered", numeric: true },
  { key: "accuracy", label: "Accuracy", numeric: true },
  { key: "calibrationGap", label: "Calibration gap", numeric: true },
  { key: "streak", label: "Streak", numeric: true },
  { key: "lastActive", label: "Last active", numeric: false },
];

function compare(a: Student, b: Student, key: SortKey): number {
  if (key === "nickname") return a.nickname.localeCompare(b.nickname, undefined, { sensitivity: "base" });
  if (key === "lastActive") return (a.lastActive ? Date.parse(a.lastActive) : 0) - (b.lastActive ? Date.parse(b.lastActive) : 0);
  return a[key] - b[key];
}

function StudentsTable({ students }: { students: Student[] }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "nickname", dir: "asc" });
  const rows = useMemo(() => {
    const sorted = [...students].sort((a, b) => compare(a, b, sort.key));
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [students, sort]);

  const toggle = (key: SortKey, numeric: boolean) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: numeric || key === "lastActive" ? "desc" : "asc" }));

  return (
    <div className="relative -mx-5 overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="sr-only">Students in this class. Column headers are buttons that sort the table.</caption>
        <thead>
          <tr className="border-b border-line text-left">
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
              return (
                <th
                  key={c.key}
                  scope="col"
                  aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  className={clsx("px-5 py-2.5 font-semibold text-muted", c.numeric && "text-right")}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key, c.numeric)}
                    className={clsx("inline-flex items-center gap-1 rounded-md hover:text-wine", active && "text-wine", c.numeric && "flex-row-reverse")}
                  >
                    {c.label}
                    <Icon className={clsx("size-3.5", !active && "opacity-40")} aria-hidden />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const gapPts = Math.round(s.calibrationGap * 100);
            return (
              <tr key={s.id} className="border-b border-line/70 last:border-0 hover:bg-tint/40">
                <th scope="row" className="px-5 py-3 text-left font-semibold text-ink">
                  {s.nickname}
                </th>
                <td className="px-5 py-3 text-right tabular-nums">{s.answered}</td>
                <td className="px-5 py-3 text-right tabular-nums">{s.answered ? percent(s.accuracy) : "—"}</td>
                <td className={clsx("px-5 py-3 text-right tabular-nums", s.answered && Math.abs(gapPts) > 10 && "font-semibold text-wine")}>
                  {s.answered ? (
                    <>
                      {formatGap(s.calibrationGap)}
                      <span className="sr-only">{gapPts > 5 ? " (overconfident)" : gapPts < -5 ? " (underconfident)" : " (well calibrated)"}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3 text-right tabular-nums">{s.streak}</td>
                <td className="whitespace-nowrap px-5 py-3 text-muted">{formatRelative(s.lastActive)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function JoinCodeCard({ code, name }: { code: string; name: string }) {
  const host = typeof window === "undefined" ? "" : window.location.host;
  return (
    <section aria-labelledby="join-code-title" className="bg-brand-dark overflow-hidden rounded-[var(--radius-card)] p-6 text-white sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <h2 id="join-code-title" className="text-xs font-bold uppercase tracking-[0.14em] text-ora-light">
            Join {name}
          </h2>
          <p className="mt-2 text-sm text-white/80 sm:text-base">
            Go to <span className="font-semibold text-white">{host ? `${host}/join` : "/join"}</span> and type this code.
          </p>
        </div>
        <CopyButton value={code} label="Copy join code" tone="dark" />
      </div>
      <p className="mt-4 break-all font-mono text-5xl font-bold tracking-[0.25em] sm:text-7xl">
        {code}
      </p>
    </section>
  );
}

export function ClassDashboard({ id }: { id: string }) {
  const [data, setData] = useState<ClassDashboardDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<ClassDashboardDTO>(`/api/classrooms/${encodeURIComponent(id)}/dashboard`)
      .then(setData)
      .catch((err: unknown) => {
        if (err instanceof ApiClientError && err.status === 404) setError("This class doesn't exist (any more).");
        else if (err instanceof ApiClientError && err.status === 403) setError("This class belongs to another teacher.");
        else setError(err instanceof Error ? err.message : "Could not load the dashboard.");
      });
  }, [id]);

  const back = (
    <Link href="/teacher" className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted hover:text-wine">
      <ArrowLeft className="size-4" aria-hidden /> All classes
    </Link>
  );

  if (error)
    return (
      <>
        <PageHeader title="Class dashboard" back={back} />
        <ErrorNote>{error}</ErrorNote>
      </>
    );
  if (!data) return <Spinner label="Loading class dashboard" />;

  const { classroom, kpis } = data;
  const totalAnswers = data.students.reduce((n, s) => n + s.answered, 0);

  return (
    <>
      <PageHeader
        eyebrow="Class dashboard"
        title={classroom.name}
        back={back}
        description={`${classroom.studentCount} ${classroom.studentCount === 1 ? "student" : "students"} · ${totalAnswers} answers so far`}
      />

      <div className="space-y-6">
        <JoinCodeCard code={classroom.joinCode} name={classroom.name} />

        <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            icon={Users}
            label="Active this week"
            value={
              <>
                {kpis.activeStudents}
                <span className="text-lg font-semibold text-subtle"> / {kpis.totalStudents}</span>
              </>
            }
            detail="Students who answered at least once in the last 7 days."
          />
          <KpiTile icon={Target} label="Class accuracy" value={totalAnswers ? percent(kpis.accuracy) : "—"} detail="Share of all answers that were correct." />
          <KpiTile
            icon={Gauge}
            tone="ora"
            label="Calibration gap"
            value={totalAnswers ? formatGap(kpis.calibrationGap) : "—"}
            detail={describeGap(kpis.calibrationGap, totalAnswers)}
          />
          <KpiTile icon={Flame} tone="ora" label="Average streak" value={`${kpis.avgStreak.toFixed(1)} days`} detail="Consecutive days with a finished daily round." />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <SectionTitle title="Accuracy over time" description="Weekly share of correct answers, last 8 weeks. Gaps are weeks with no answers." />
            {data.accuracyByWeek.some((w) => w.answered > 0) ? (
              <AccuracyLineChart weeks={data.accuracyByWeek} />
            ) : (
              <EmptyState icon={LineChart} title="No answers yet">
                The chart fills in as soon as students play their first daily round.
              </EmptyState>
            )}
          </Card>
          <Card>
            <SectionTitle title="Hardest clue types" description="Accuracy on items whose clues are of each type, lowest first. Good topics for a class discussion." />
            {data.accuracyByTag.length > 0 ? (
              <ClueTypeBars tags={data.accuracyByTag} />
            ) : (
              <p className="text-sm text-muted">Clue types appear here once students have answered a few items.</p>
            )}
          </Card>
        </div>

        <Card>
          <SectionTitle
            title="Before and after"
            description="Compares the class's accuracy on the fixed pre-assessment (set A) with the post-assessment (set B)."
          />
          {data.prePost.pre && data.prePost.post ? (
            <div className="max-w-2xl">
              <PrePostBars pre={data.prePost.pre} post={data.prePost.post} />
            </div>
          ) : (
            <EmptyState icon={ClipboardCheck} title="No comparison yet">
              <p>
                Ask students to play the <span className="font-mono text-wine">assessment_pre</span> round at the start of the unit and the{" "}
                <span className="font-mono text-wine">assessment_post</span> round at the end. Each can be taken once.
              </p>
              <p className="mt-2">
                {data.prePost.pre
                  ? `${data.prePost.pre.students} ${data.prePost.pre.students === 1 ? "student has" : "students have"} taken the pre-assessment so far.`
                  : "Nobody has taken the pre-assessment yet."}
              </p>
            </EmptyState>
          )}
        </Card>

        <Card>
          <SectionTitle title="Students" description="Click a column header to sort. A positive calibration gap means more confident than correct." />
          {data.students.length > 0 ? (
            <StudentsTable students={data.students} />
          ) : (
            <EmptyState icon={Users} title="No students have joined">
              Share the join code above. Students go to <span className="font-mono text-wine">/join</span> on the player site and pick a nickname.
            </EmptyState>
          )}
        </Card>

        <p className="flex items-start gap-2 text-xs text-muted">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Privacy: students are identified only by the nickname they choose. No names, emails or other personal data are collected.
        </p>
      </div>
    </>
  );
}

/** Presentational pieces shared by the staff pages. */
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ItemStatus, Label, ReviewStatus } from "@/lib/contracts";
import { REVIEW_LABELS, STATUS_LABELS } from "./labels";

type BadgeTone = "wine" | "ora" | "plum" | "neutral" | "solid";

const badgeTones: Record<BadgeTone, string> = {
  wine: "bg-tint text-wine",
  ora: "bg-ora-tint text-ora-deep",
  plum: "bg-plum-3/10 text-plum-3",
  neutral: "bg-white text-subtle ring-1 ring-inset ring-line",
  solid: "bg-wine text-white",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold", badgeTones[tone])}>
      {children}
    </span>
  );
}

export function LabelBadge({ label }: { label: Label }) {
  return label === "ai" ? <Badge tone="ora">AI-made</Badge> : <Badge tone="plum">Real</Badge>;
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  const tone: BadgeTone = status === "published" ? "solid" : status === "draft" ? "wine" : "neutral";
  return <Badge tone={tone}>{STATUS_LABELS[status]}</Badge>;
}

export function ReviewBadge({ review }: { review: ReviewStatus }) {
  return <Badge tone={review === "reviewed" ? "plum" : "ora"}>{REVIEW_LABELS[review]}</Badge>;
}

/** KPI tile: icon, big value, label and an optional sentence of context. */
export function KpiTile({
  icon: Icon,
  label,
  value,
  detail,
  tone = "wine",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  tone?: "wine" | "ora";
}) {
  return (
    <div className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5">
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className={clsx("grid size-8 place-items-center rounded-lg", tone === "wine" ? "bg-tint text-wine" : "bg-ora-tint text-ora-deep")}
        >
          <Icon className="size-4" />
        </span>
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className="mt-4 text-3xl font-bold leading-none tracking-tight text-ink">{value}</p>
      {detail && <p className="mt-2 text-xs leading-relaxed text-muted">{detail}</p>}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-[var(--radius-card)] border border-dashed border-line bg-white px-6 py-10 text-center">
      <span aria-hidden className="grid size-12 place-items-center rounded-2xl bg-tint text-wine">
        <Icon className="size-6" />
      </span>
      <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
      <div className="mt-2 max-w-md text-sm text-muted">{children}</div>
    </div>
  );
}

export function SectionTitle({ title, description, id }: { title: string; description?: ReactNode; id?: string }) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-base font-bold text-ink">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
    </div>
  );
}

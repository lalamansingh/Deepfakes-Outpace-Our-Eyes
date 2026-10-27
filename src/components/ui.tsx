/** Shared UI primitives. Both the player app and the staff app build on these. */
import clsx from "clsx";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "wine" | "outline" | "ghost" | "dark";

const variants: Record<Variant, string> = {
  primary: "bg-gradient-ora text-white shadow-[0_10px_28px_rgb(255_113_58/0.35)] hover:brightness-105",
  wine: "bg-gradient-wine text-white hover:brightness-110",
  outline: "border-2 border-ink text-ink bg-white hover:bg-tint",
  ghost: "text-wine hover:bg-tint",
  dark: "bg-plum-2 text-white hover:bg-plum-3",
};

type Size = "sm" | "md" | "lg";

const sizes: Record<Size, string> = {
  sm: "rounded-xl px-3.5 py-2 text-sm",
  md: "rounded-2xl px-5 py-3 text-sm",
  lg: "rounded-2xl px-6 py-4 text-base",
};

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50";

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={clsx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={clsx(base, sizes[size], variants[variant], className)} {...props} />;
}

export function Card({ className, tone = "white", ...props }: ComponentProps<"div"> & { tone?: "white" | "tint" | "ora" | "dark" }) {
  const tones = {
    white: "bg-white border border-line",
    tint: "bg-tint",
    ora: "bg-ora-tint",
    dark: "bg-plum-2 text-white",
  };
  return <div className={clsx("rounded-[var(--radius-card)] p-5", tones[tone], className)} {...props} />;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("text-xs font-bold uppercase tracking-[0.14em] text-wine", className)}>{children}</p>;
}

export function Stat({ value, label, tone = "wine" }: { value: ReactNode; label: ReactNode; tone?: "wine" | "ora" }) {
  return (
    <div>
      <div className={clsx("text-3xl font-bold leading-none", tone === "wine" ? "text-wine" : "text-ora-deep")}>{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

export function Spinner({ label = "Loading" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span className="size-4 animate-spin rounded-full border-2 border-line border-t-wine" aria-hidden />
      {label}…
    </span>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-wine/30 bg-tint px-4 py-3 text-sm text-wine">
      {children}
    </p>
  );
}

export function percent(n: number, digits = 0) {
  return `${(n * 100).toFixed(digits)}%`;
}

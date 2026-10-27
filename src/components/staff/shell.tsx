"use client";

import clsx from "clsx";
import { ExternalLink, Gauge, Images, LogOut, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useStaff } from "./auth";
import { BrandMark } from "./brand";

type NavItem = { href: string; label: string; icon: typeof Users; match: (path: string) => boolean };

const TEACHER_NAV: NavItem[] = [{ href: "/teacher", label: "My classes", icon: Users, match: (p) => p.startsWith("/teacher") }];
const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: Gauge, match: (p) => p === "/admin" },
  { href: "/admin/items", label: "Content library", icon: Images, match: (p) => p.startsWith("/admin/items") },
];

/** Light app shell: plum sidebar on desktop, compact plum top bar on small screens. */
export function StaffShell({ children }: { children: ReactNode }) {
  const { staff, signOut } = useStaff();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);
  const nav = staff.role === "admin" ? [...TEACHER_NAV, ...ADMIN_NAV] : TEACHER_NAV;
  const initials = staff.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
  };

  const navLinks = (items: NavItem[], layout: "row" | "column") =>
    items.map((item) => {
      const active = item.match(pathname);
      const Icon = item.icon;
      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? "page" : undefined}
          className={clsx(
            "flex shrink-0 items-center gap-2.5 rounded-xl text-sm font-medium transition",
            layout === "column" ? "px-3 py-2.5" : "px-3 py-2",
            active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
          )}
        >
          <Icon className={clsx("size-4", active && "text-ora")} aria-hidden />
          {item.label}
        </Link>
      );
    });

  return (
    <div className="min-h-dvh bg-tint/40 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#staff-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-wine"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh flex-col bg-plum px-4 py-6 text-white lg:flex">
        <div className="px-2">
          <BrandMark href={staff.role === "admin" ? "/admin" : "/teacher"} />
        </div>
        <nav aria-label="Staff" className="mt-8 flex flex-col gap-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Teaching</p>
          {navLinks(TEACHER_NAV, "column")}
          {staff.role === "admin" && (
            <>
              <p className="mt-5 px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">Content studio</p>
              {navLinks(ADMIN_NAV, "column")}
            </>
          )}
        </nav>
        <div className="mt-auto space-y-3">
          <Link href="/" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-white/70 transition hover:bg-white/8 hover:text-white">
            <ExternalLink className="size-4" aria-hidden />
            Player site
          </Link>
          <div className="rounded-2xl bg-plum-2 p-3">
            <div className="flex items-center gap-3">
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-wine text-xs font-bold">
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{staff.name}</p>
                <p className="truncate text-xs text-white/60">{staff.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-white/85 transition hover:bg-white/8 disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="bg-plum text-white lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <BrandMark href={staff.role === "admin" ? "/admin" : "/teacher"} />
          <div className="flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-white/80 sm:inline">{staff.name}</span>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-sm font-medium text-white/85 hover:bg-white/8 disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden />
              <span>Sign out</span>
            </button>
          </div>
        </div>
        <nav aria-label="Staff" className="flex gap-1 overflow-x-auto px-3 pb-3">
          {navLinks(nav, "row")}
        </nav>
      </header>

      <main id="staff-main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/** Consistent page heading with optional actions on the right. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
}) {
  return (
    <div className="mb-8">
      {back && <div className="mb-3">{back}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.14em] text-wine">{eyebrow}</p>}
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          {description && <p className="mt-2 max-w-2xl text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

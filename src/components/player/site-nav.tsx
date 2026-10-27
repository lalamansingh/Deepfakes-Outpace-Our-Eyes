"use client";

import clsx from "clsx";
import { BarChart3, Dumbbell, Grid2x2, Play, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/play", label: "Daily", icon: Play },
  { href: "/spot", label: "Spot", icon: Grid2x2 },
  { href: "/practice", label: "Practice", icon: Dumbbell },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/join", label: "Class", icon: Users },
] as const;

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main">
      <ul className="grid grid-cols-5 gap-0.5 sm:flex sm:gap-1.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition sm:flex-row sm:gap-2 sm:px-3 sm:text-sm",
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/8 hover:text-white",
                )}
              >
                <Icon className={clsx("size-4", active && "text-ora")} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

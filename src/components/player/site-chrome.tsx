import clsx from "clsx";
import Link from "next/link";
import { Logo } from "./logo";
import { SiteNav } from "./site-nav";

export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only z-50 rounded-xl bg-white px-4 py-2 font-semibold text-wine focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
    >
      Skip to content
    </a>
  );
}

/** Top bar for every player page. `transparent` lets it sit on top of a dark hero. */
export function SiteHeader({ transparent = false }: { transparent?: boolean }) {
  return (
    <header className={clsx("text-white", !transparent && "border-b border-white/10 bg-plum")}>
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo />
        <SiteNav />
      </div>
    </header>
  );
}

const footerLinks = [
  { href: "/progress", label: "Your progress" },
  { href: "/join", label: "Join a class" },
  { href: "/credits", label: "Credits" },
  { href: "/about", label: "About & privacy" },
  { href: "/staff/login", label: "For teachers" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          <span className="font-semibold text-ink">Real or Rendered?</span> · Train your eye in five minutes a day.
        </p>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="rounded hover:text-wine hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

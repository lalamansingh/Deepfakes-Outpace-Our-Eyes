import Link from "next/link";

/** Brand mark: an eye whose iris is half "real" (wine) and half "rendered" (orange). */
export function LogoMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      <defs>
        <linearGradient id="rr-mark-ora" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff962d" />
          <stop offset="1" stopColor="#ff713a" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#271d2b" />
      <path d="M8 32c6-10 14-15 24-15s18 5 24 15c-6 10-14 15-24 15S14 42 8 32Z" fill="none" stroke="url(#rr-mark-ora)" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 22a10 10 0 0 0 0 20Z" fill="#8b1040" />
      <path d="M32 22a10 10 0 0 1 0 20Z" fill="url(#rr-mark-ora)" />
    </svg>
  );
}

export function Logo({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg font-bold tracking-tight">
      <LogoMark />
      <span className={tone === "light" ? "text-white" : "text-ink"}>
        Real <span className="text-ora">or</span> Rendered?
      </span>
    </Link>
  );
}

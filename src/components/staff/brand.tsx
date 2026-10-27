import Link from "next/link";

/** "Real or Rendered? · Staff" wordmark. */
export function BrandMark({ tone = "light", href = "/teacher" }: { tone?: "light" | "dark"; href?: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-2.5 rounded-lg">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-ora text-base font-extrabold text-white">
        R?
      </span>
      <span className={tone === "light" ? "leading-tight text-white" : "leading-tight text-ink"}>
        <span className="block text-sm font-bold">Real or Rendered?</span>
        <span className={tone === "light" ? "block text-xs font-medium text-ora-light" : "block text-xs font-medium text-wine"}>Staff</span>
      </span>
    </Link>
  );
}

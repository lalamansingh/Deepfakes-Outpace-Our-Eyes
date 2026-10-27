import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui";

/** Light content page with a consistent heading block. */
export function PageShell({
  eyebrow,
  title,
  intro,
  children,
  width = "max-w-4xl",
}: {
  eyebrow: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div className="bg-white">
      <div className="border-b border-line bg-tint/60">
        <div className={`mx-auto ${width} px-4 py-10 sm:px-6 sm:py-14`}>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink sm:text-4xl">{title}</h1>
          {intro ? <div className="mt-3 max-w-2xl text-base leading-relaxed text-muted">{intro}</div> : null}
        </div>
      </div>
      <div className={`mx-auto ${width} px-4 py-10 sm:px-6`}>{children}</div>
    </div>
  );
}

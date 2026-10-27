import type { Metadata } from "next";
import { CreditsTable } from "@/components/player/credits-table";
import { PageShell } from "@/components/player/page-shell";

export const metadata: Metadata = { title: "Credits" };

export default function CreditsPage() {
  return (
    <PageShell
      eyebrow="Credits"
      title="Thanks to the creators"
      intro={
        <>
          Our real photos, recordings and many AI-generated examples come from{" "}
          <a href="https://commons.wikimedia.org" target="_blank" rel="noopener noreferrer" className="font-medium text-wine underline underline-offset-2">
            Wikimedia Commons
          </a>{" "}
          and are used under free licences. Each item links to its original page and licence.
        </>
      }
    >
      <CreditsTable />
    </PageShell>
  );
}

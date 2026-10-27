"use client";

import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { Spinner } from "@/components/ui";
import { friendlyError } from "./errors";
import { RetryError } from "./retry-error";

type Credit = { author: string; license: string; licenseUrl: string | null; sourceUrl: string };
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; credits: Credit[] };

const linkClass = "inline-flex items-center gap-1 font-medium text-wine underline-offset-2 hover:underline";

export function CreditsTable() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const { credits } = await api.get<{ credits: Credit[] }>("/api/credits");
      setState({ status: "ready", credits });
    } catch (err) {
      setState({ status: "error", message: friendlyError(err) });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (state.status === "loading") return <Spinner label="Loading credits" />;
  if (state.status === "error") return <RetryError message={state.message} onRetry={() => void load()} />;
  if (state.credits.length === 0) return <p className="text-muted">No media published yet.</p>;

  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <caption className="sr-only">Authors, licences and sources of the media used in the game</caption>
        <thead className="bg-tint text-xs uppercase tracking-wide text-muted">
          <tr>
            <th scope="col" className="w-[42%] px-3 py-3 font-semibold sm:px-5">
              Author
            </th>
            <th scope="col" className="px-3 py-3 font-semibold sm:px-5">
              Licence
            </th>
            <th scope="col" className="w-[24%] px-3 py-3 font-semibold sm:px-5">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {state.credits.map((c, i) => (
            <tr key={`${i}-${c.sourceUrl}`} className="border-t border-line align-top">
              <td className="break-words px-3 py-3 text-ink sm:px-5">{c.author}</td>
              <td className="break-words px-3 py-3 sm:px-5">
                {c.licenseUrl ? (
                  <a href={c.licenseUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                    {c.license}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <span className="text-muted">{c.license}</span>
                )}
              </td>
              <td className="px-3 py-3 sm:px-5">
                <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
                  View
                  <ExternalLink className="size-3.5" aria-hidden />
                  <span className="sr-only"> source for {c.author} (opens in a new tab)</span>
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

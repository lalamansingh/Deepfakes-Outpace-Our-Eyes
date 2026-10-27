"use client";

import { CheckCircle2, Play, Users } from "lucide-react";
import { useState } from "react";
import { api, ApiClientError } from "@/lib/api-client";
import { joinClassroomSchema, type PlayerDTO } from "@/lib/contracts";
import { Button, ButtonLink, Card, ErrorNote } from "@/components/ui";
import { friendlyError } from "./errors";

const inputClass =
  "w-full rounded-xl border-2 border-line bg-white px-4 py-3 text-base text-ink placeholder:text-subtle transition focus:border-wine focus:outline-none aria-[invalid=true]:border-wine";

export function JoinForm() {
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ code?: string; nickname?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [joined, setJoined] = useState<PlayerDTO | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const parsed = joinClassroomSchema.safeParse({ code, nickname });
    if (!parsed.success) {
      const f = parsed.error.flatten().fieldErrors;
      setFieldErrors({
        code: f.code ? "Enter the 6 letters or digits your teacher gave you." : undefined,
        nickname: f.nickname ? "Use 2–24 letters, numbers, spaces, _ . or -." : undefined,
      });
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      await api.post("/api/session");
      setJoined(await api.post<PlayerDTO>("/api/classrooms/join", parsed.data));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 404) setError("We couldn't find a class with that code. Check it with your teacher.");
      else setError(friendlyError(err));
    } finally {
      setPending(false);
    }
  }

  if (joined) {
    return (
      <Card className="flex flex-col items-start gap-4 p-8" role="status">
        <CheckCircle2 className="size-10 text-wine" aria-hidden />
        <h2 className="text-2xl font-bold text-ink">You&apos;re in!</h2>
        <p className="text-muted">
          You joined <strong className="text-ink">{joined.classroom?.name ?? "the class"}</strong> as{" "}
          <strong className="text-ink">{joined.nickname ?? nickname}</strong>. Your teacher will see your progress under this nickname.
        </p>
        <p className="text-sm text-muted">
          Start with the 8-item starting check: it shows your teacher where the class begins, so everyone can see how much you improve.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/check/start">Take the starting check</ButtonLink>
          <ButtonLink href="/play" variant="outline">
            <Play className="size-4" aria-hidden /> Play today&apos;s challenge
          </ButtonLink>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 sm:p-8">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div>
          <label htmlFor="join-code" className="mb-1.5 block text-sm font-semibold text-ink">
            Class code
          </label>
          <input
            id="join-code"
            name="code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={6}
            placeholder="ABC123"
            aria-invalid={fieldErrors.code ? true : undefined}
            aria-describedby={fieldErrors.code ? "join-code-error" : "join-code-hint"}
            className={`${inputClass} font-mono text-2xl tracking-[0.4em] uppercase`}
          />
          {fieldErrors.code ? (
            <p id="join-code-error" className="mt-1.5 text-sm text-wine">
              {fieldErrors.code}
            </p>
          ) : (
            <p id="join-code-hint" className="mt-1.5 text-sm text-muted">
              6 letters or digits, from your teacher.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="join-nickname" className="mb-1.5 block text-sm font-semibold text-ink">
            Nickname
          </label>
          <input
            id="join-nickname"
            name="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="nickname"
            maxLength={24}
            placeholder="e.g. PixelDetective"
            aria-invalid={fieldErrors.nickname ? true : undefined}
            aria-describedby={fieldErrors.nickname ? "join-nickname-error" : "join-nickname-hint"}
            className={inputClass}
          />
          {fieldErrors.nickname ? (
            <p id="join-nickname-error" className="mt-1.5 text-sm text-wine">
              {fieldErrors.nickname}
            </p>
          ) : (
            <p id="join-nickname-hint" className="mt-1.5 text-sm text-muted">
              Tip: you don&apos;t need your real name. Your teacher just needs to recognise you.
            </p>
          )}
        </div>

        {error && <ErrorNote>{error}</ErrorNote>}

        <Button type="submit" disabled={pending} className="py-4 text-base">
          <Users className="size-4" aria-hidden />
          {pending ? "Joining…" : "Join class"}
        </Button>
      </form>
    </Card>
  );
}

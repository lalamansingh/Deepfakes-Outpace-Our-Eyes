"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import { loginSchema, registerSchema, type StaffDTO } from "@/lib/contracts";
import { Button, ErrorNote } from "@/components/ui";
import { homeFor, safeNext } from "./auth";
import { BrandMark } from "./brand";
import { TextField, toFieldErrors, type FieldErrors } from "./form";

/** Split-screen frame for the sign-in and sign-up pages. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="bg-brand-dark relative hidden flex-col justify-between p-12 text-white lg:flex" aria-label="About the staff area">
        <BrandMark href="/" />
        <div className="max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ora-light">For teachers & curators</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">See how your class learns to spot the fakes.</h2>
          <p className="mt-4 text-base text-white/75">
            Create a class, share a six-character code, and follow accuracy, confidence and the clue types your students still miss.
          </p>
        </div>
        <p className="text-xs text-white/50">Students only ever share a nickname. No personal data is collected.</p>
      </section>
      <section className="flex flex-col bg-tint/40 px-4 py-8 sm:px-8">
        <div className="lg:hidden">
          <BrandMark tone="dark" href="/" />
        </div>
        <div className="m-auto w-full max-w-sm py-8">
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
          <p className="mt-2 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
        <p className="text-center text-sm text-muted">
          Looking for the game?{" "}
          <Link href="/" className="font-semibold text-wine underline-offset-4 hover:underline">
            Back to the player site
          </Link>
        </p>
      </section>
    </div>
  );
}

function useAfterSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  return (staff: StaffDTO) => {
    const next = safeNext(params.get("next"));
    // Teachers should not be bounced into an admin page they cannot open.
    const allowed = next && (staff.role === "admin" || !next.startsWith("/admin")) ? next : null;
    router.replace(allowed ?? homeFor(staff));
  };
}

function serverMessage(err: unknown, fallback: string) {
  if (err instanceof ApiClientError) {
    if (err.status === 429) return "Too many attempts. Please wait a minute and try again.";
    return err.message;
  }
  return fallback;
}

export function LoginForm() {
  const afterSignIn = useAfterSignIn();
  const params = useSearchParams();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = loginSchema.safeParse({ email: data.get("email"), password: data.get("password") });
    setServerError(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      afterSignIn(await api.post<StaffDTO>("/api/auth/login", parsed.data));
    } catch (err) {
      setServerError(
        err instanceof ApiClientError && err.status === 401 ? "That email and password don't match an account." : serverMessage(err, "Could not sign in."),
      );
      setBusy(false);
    }
  };

  const next = params.get("next");
  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && <ErrorNote>{serverError}</ErrorNote>}
      <TextField label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
      <TextField label="Password" name="password" type="password" autoComplete="current-password" required error={errors.password} />
      <Button type="submit" variant="wine" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted">
        New teacher?{" "}
        <Link
          href={next ? `/staff/register?next=${encodeURIComponent(next)}` : "/staff/register"}
          className="font-semibold text-wine underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const afterSignIn = useAfterSignIn();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const parsed = registerSchema.safeParse({ name: data.get("name"), email: data.get("email"), password: data.get("password") });
    setServerError(null);
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      afterSignIn(await api.post<StaffDTO>("/api/auth/register", parsed.data));
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        setErrors({ email: "An account with this email already exists. Try signing in instead." });
      } else {
        setServerError(serverMessage(err, "Could not create your account."));
      }
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {serverError && <ErrorNote>{serverError}</ErrorNote>}
      <TextField label="Your name" name="name" autoComplete="name" required error={errors.name} hint="Shown only to you and other staff." />
      <TextField label="School email" name="email" type="email" autoComplete="email" required error={errors.email} />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.password}
        hint="At least 10 characters. A short sentence works well."
      />
      <Button type="submit" variant="wine" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create teacher account"}
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/staff/login" className="font-semibold text-wine underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

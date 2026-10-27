"use client";

import { ShieldAlert } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import type { StaffDTO } from "@/lib/contracts";
import { Button, ButtonLink, Card, ErrorNote, Spinner } from "@/components/ui";

type StaffContextValue = { staff: StaffDTO; signOut: () => Promise<void> };

const StaffContext = createContext<StaffContextValue | null>(null);

/**
 * Only allow same-origin paths as post-login destinations. The value is resolved
 * the way the browser would resolve it (which drops tabs/newlines and treats
 * "\" like "/"), so tricks like "/%09/evil.com" or "/\evil.com" cannot leave the site.
 */
export function safeNext(next: string | null | undefined, origin = typeof window === "undefined" ? "http://localhost" : window.location.origin): string | null {
  if (!next || !next.startsWith("/")) return null;
  let url: URL;
  try {
    url = new URL(next, origin);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function homeFor(staff: StaffDTO) {
  return staff.role === "admin" ? "/admin" : "/teacher";
}

type State = { status: "loading" } | { status: "ready"; staff: StaffDTO } | { status: "error"; message: string };

/**
 * Loads the signed-in staff member once for the whole staff app.
 * Redirects to /staff/login?next=… when there is no session.
 */
export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .get<StaffDTO>("/api/auth/me")
      .then((staff) => {
        if (!cancelled) setState({ status: "ready", staff });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiClientError && err.status === 401) {
          const search = typeof window === "undefined" ? "" : window.location.search;
          router.replace(`/staff/login?next=${encodeURIComponent(pathname + search)}`);
          return;
        }
        setState({ status: "error", message: err instanceof Error ? err.message : "Could not check your session." });
      });
    return () => {
      cancelled = true;
    };
    // Only re-check when the user retries; navigation inside the app keeps the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const signOut = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      router.replace("/staff/login");
    }
  }, [router]);

  if (state.status === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-tint/40">
        <Spinner label="Checking your session" />
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="grid min-h-dvh place-items-center bg-tint/40 p-4">
        <Card className="w-full max-w-md space-y-4">
          <ErrorNote>{state.message}</ErrorNote>
          <Button
            variant="wine"
            onClick={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }
  return <StaffContext.Provider value={{ staff: state.staff, signOut }}>{children}</StaffContext.Provider>;
}

export function useStaff(): StaffContextValue {
  const ctx = useContext(StaffContext);
  if (!ctx) throw new Error("useStaff must be used inside <StaffAuthProvider>");
  return ctx;
}

/** Renders children only for admins; everyone else gets a friendly 403. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { staff } = useStaff();
  if (staff.role === "admin") return <>{children}</>;
  return (
    <Card className="mx-auto mt-8 max-w-lg text-center">
      <ShieldAlert className="mx-auto size-10 text-wine" aria-hidden />
      <h1 className="mt-3 text-xl font-bold">Admins only</h1>
      <p className="mt-2 text-sm text-muted">
        The content studio is for the people who curate the image, voice and video library. Your account is a teacher account, so you
        can manage your classes and see their progress instead.
      </p>
      <ButtonLink href="/teacher" variant="wine" className="mt-5">
        Go to my classes
      </ButtonLink>
    </Card>
  );
}

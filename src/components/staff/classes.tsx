"use client";

import { ArrowRight, CalendarDays, Plus, Users, UsersRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ApiClientError, api } from "@/lib/api-client";
import { createClassroomSchema, type ClassroomDTO } from "@/lib/contracts";
import { Button, Card, ErrorNote, Spinner } from "@/components/ui";
import { EmptyState, SectionTitle } from "./bits";
import { CopyButton } from "./copy-button";
import { formatDate } from "./format";
import { TextField, toFieldErrors } from "./form";
import { PageHeader } from "./shell";

function CreateClassForm({ onCreated }: { onCreated: (c: ClassroomDTO) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const parsed = createClassroomSchema.safeParse({ name });
    if (!parsed.success) {
      setError(toFieldErrors(parsed.error).name);
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      onCreated(await api.post<ClassroomDTO>("/api/classrooms", parsed.data));
      setName("");
    } catch (err) {
      setServerError(err instanceof ApiClientError ? err.message : "Could not create the class.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <SectionTitle title="Create a class" description="You get a join code to share with students straight away." />
      <form onSubmit={submit} noValidate className="space-y-3">
        {serverError && <ErrorNote>{serverError}</ErrorNote>}
        <div className="flex flex-col gap-3">
          <TextField
            label="Class name"
            name="name"
            placeholder="e.g. 9B Media literacy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={error}
            required
          />
          <Button type="submit" variant="wine" disabled={busy}>
            <Plus className="size-4" aria-hidden />
            {busy ? "Creating…" : "Create class"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ClassCard({ classroom }: { classroom: ClassroomDTO }) {
  return (
    <li className="flex flex-col rounded-[var(--radius-card)] border border-line bg-white p-5 transition hover:border-wine/40">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 text-base font-bold text-ink">
          <Link href={`/teacher/classes/${classroom.id}`} className="break-words hover:text-wine">
            {classroom.name}
          </Link>
        </h3>
      </div>
      <div className="mt-4 flex items-center justify-between gap-2 rounded-xl bg-tint px-3 py-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Join code</p>
          <p className="font-mono text-xl font-bold tracking-[0.2em] text-wine">{classroom.joinCode}</p>
        </div>
        <CopyButton value={classroom.joinCode} label={`Copy join code for ${classroom.name}`} />
      </div>
      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
        <div className="flex items-center gap-1.5">
          <Users className="size-4" aria-hidden />
          <dt className="sr-only">Students</dt>
          <dd>
            {classroom.studentCount} {classroom.studentCount === 1 ? "student" : "students"}
          </dd>
        </div>
        <div className="flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden />
          <dt className="sr-only">Created</dt>
          <dd>Created {formatDate(classroom.createdAt)}</dd>
        </div>
      </dl>
      <Link
        href={`/teacher/classes/${classroom.id}`}
        className="mt-5 inline-flex items-center gap-1.5 self-start rounded-lg text-sm font-semibold text-wine hover:underline"
        aria-label={`Open dashboard for ${classroom.name}`}
      >
        Open dashboard <ArrowRight className="size-4" aria-hidden />
      </Link>
    </li>
  );
}

export function TeacherClasses() {
  const [classes, setClasses] = useState<ClassroomDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ classrooms: ClassroomDTO[] }>("/api/classrooms")
      .then((r) => setClasses(r.classrooms))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load your classes."));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Teaching"
        title="My classes"
        description="Each class has its own join code. Students join with a nickname only, and you see how the class is learning."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-labelledby="class-list-title" className="order-2 lg:order-1">
          <h2 id="class-list-title" className="sr-only">
            Your classes
          </h2>
          {error && <ErrorNote>{error}</ErrorNote>}
          {!error && classes === null && <Spinner label="Loading classes" />}
          {classes && classes.length === 0 && (
            <EmptyState icon={UsersRound} title="No classes yet">
              <p>Create your first class and you will get a six-character join code.</p>
              <ol className="mt-4 space-y-1.5 text-left">
                <li>
                  <span className="font-semibold text-ink">1.</span> Students open the player site and go to <span className="font-mono text-wine">/join</span>.
                </li>
                <li>
                  <span className="font-semibold text-ink">2.</span> They type your class code and pick a nickname — no email or real name needed.
                </li>
                <li>
                  <span className="font-semibold text-ink">3.</span> Their daily rounds show up on your class dashboard.
                </li>
              </ol>
            </EmptyState>
          )}
          {classes && classes.length > 0 && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {classes.map((c) => (
                <ClassCard key={c.id} classroom={c} />
              ))}
            </ul>
          )}
        </section>
        <div className="order-1 lg:order-2">
          <CreateClassForm onCreated={(c) => setClasses((prev) => [c, ...(prev ?? [])])} />
        </div>
      </div>
    </>
  );
}

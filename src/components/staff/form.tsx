/** Labelled form controls with inline, programmatically associated errors. */
import clsx from "clsx";
import { useId, type ComponentProps, type ReactNode } from "react";
import type { ZodError, ZodIssue } from "zod";

export type FieldErrors = Record<string, string>;

function friendlyMessage(issue: ZodIssue): string {
  switch (issue.code) {
    case "too_small":
      if (issue.type === "string") return issue.minimum === 1 ? "This field is required." : `Use at least ${String(issue.minimum)} characters.`;
      if (issue.type === "array") return `Add at least ${String(issue.minimum)}.`;
      return issue.message;
    case "too_big":
      if (issue.type === "string") return `Use at most ${String(issue.maximum)} characters.`;
      if (issue.type === "array") return `Use at most ${String(issue.maximum)}.`;
      return issue.message;
    case "invalid_string":
      if (issue.validation === "email") return "Enter a valid email address.";
      if (issue.validation === "url") return "Enter a full URL, starting with https://";
      return issue.message;
    case "invalid_type":
      return issue.received === "undefined" || issue.received === "null" ? "This field is required." : issue.message;
    default:
      return issue.message;
  }
}

/** Flattens a ZodError into `{ "path.to.field": "first message" }`. */
export function toFieldErrors(error: ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = friendlyMessage(issue);
  }
  return out;
}

const control =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-subtle transition focus:border-wine focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ora disabled:cursor-not-allowed disabled:bg-tint/60 disabled:text-subtle aria-[invalid=true]:border-wine aria-[invalid=true]:bg-tint/40";

type FieldShellProps = {
  label: ReactNode;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

function FieldShell({ label, error, hint, required, className, children }: FieldShellProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="text-wine" aria-hidden>
            {" "}
            *
          </span>
        )}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-wine">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = { label: ReactNode; error?: string; hint?: ReactNode; className?: string };

export function TextField({ label, error, hint, className, required, ...props }: Common & ComponentProps<"input">) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} aria-required={required} className={control} {...props} />
      )}
    </FieldShell>
  );
}

export function TextAreaField({ label, error, hint, className, required, ...props }: Common & ComponentProps<"textarea">) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <textarea
          id={id}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          aria-required={required}
          className={clsx(control, "min-h-24 resize-y")}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function SelectField({
  label,
  error,
  hint,
  className,
  required,
  options,
  ...props
}: Common & ComponentProps<"select"> & { options: readonly { value: string; label: string }[] }) {
  return (
    <FieldShell label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} aria-required={required} className={clsx(control, "pr-8")} {...props}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </FieldShell>
  );
}

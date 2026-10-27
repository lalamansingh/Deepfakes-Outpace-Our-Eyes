/** Small formatting helpers for the staff dashboards. */

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

/** "3 Mar" for an ISO week start (dates are UTC day keys). */
export function formatWeek(iso: string) {
  return shortDateFmt.format(new Date(iso));
}

export function formatRelative(iso: string | null, now = Date.now()) {
  if (!iso) return "Never";
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso);
}

/** Calibration gap (avg confidence − accuracy) as signed percentage points. */
export function formatGap(gap: number) {
  const pts = Math.round(gap * 100);
  return `${pts > 0 ? "+" : ""}${pts} pts`;
}

/** Plain-language reading of a calibration gap, for teachers. */
export function describeGap(gap: number, answered = 1) {
  if (answered === 0) return "No answers yet, so there is nothing to compare.";
  const pts = Math.abs(Math.round(gap * 100));
  if (pts <= 5) return "Well calibrated: confidence matches how often they are right.";
  if (gap > 0) return `Overconfident: students feel ${pts} points surer than their accuracy justifies.`;
  return `Underconfident: students are right ${pts} points more often than they feel.`;
}

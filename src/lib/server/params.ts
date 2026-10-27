import { z } from "zod";
import { notFound } from "./http";

const uuid = z.string().uuid();

/** Route ids that are not UUIDs can never exist, so they are a 404, not a database error. */
export function idParam(value: string | undefined, what = "Resource"): string {
  const parsed = uuid.safeParse(value);
  if (!parsed.success) throw notFound(what);
  return parsed.data;
}

import { ApiClientError } from "@/lib/api-client";

/** Turns any thrown value into a friendly, human sentence for ErrorNote. */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiClientError) {
    if (err.status === 429) return "You're going a little fast. Take a breath and try again in a few seconds.";
    if (err.status >= 500) return "Our server hit a snag. Please try again in a moment.";
    return err.message;
  }
  return "We couldn't reach the server. Check your connection and try again.";
}

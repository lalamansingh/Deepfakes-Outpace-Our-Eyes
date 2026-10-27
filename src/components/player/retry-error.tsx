import { RotateCcw } from "lucide-react";
import { Button, ErrorNote } from "@/components/ui";

export function RetryError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <ErrorNote>{message}</ErrorNote>
      <Button variant="wine" onClick={onRetry}>
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </Button>
    </div>
  );
}

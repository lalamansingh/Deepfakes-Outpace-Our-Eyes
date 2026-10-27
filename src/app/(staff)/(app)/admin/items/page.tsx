import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemsList } from "@/components/staff/items-list";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "Content library" };

export default function ItemsPage() {
  return (
    <Suspense fallback={<Spinner label="Loading items" />}>
      <ItemsList />
    </Suspense>
  );
}

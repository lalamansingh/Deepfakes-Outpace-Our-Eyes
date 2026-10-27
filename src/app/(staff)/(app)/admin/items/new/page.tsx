import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemEditor } from "@/components/staff/item-editor";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "New item" };

export default function NewItemPage() {
  return (
    <Suspense fallback={<Spinner label="Loading editor" />}>
      <ItemEditor />
    </Suspense>
  );
}

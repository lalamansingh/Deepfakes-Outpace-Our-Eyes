import type { Metadata } from "next";
import { Suspense } from "react";
import { ItemEditor } from "@/components/staff/item-editor";
import { Spinner } from "@/components/ui";

export const metadata: Metadata = { title: "Edit item" };

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<Spinner label="Loading editor" />}>
      <ItemEditor key={id} id={id} />
    </Suspense>
  );
}

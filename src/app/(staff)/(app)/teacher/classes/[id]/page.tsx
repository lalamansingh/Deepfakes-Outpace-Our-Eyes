import type { Metadata } from "next";
import { ClassDashboard } from "@/components/staff/class-dashboard";

export const metadata: Metadata = { title: "Class dashboard" };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ClassDashboard id={id} />;
}

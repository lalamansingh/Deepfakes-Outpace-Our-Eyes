import type { Metadata } from "next";
import { AdminOverview } from "@/components/staff/admin-overview";

export const metadata: Metadata = { title: "Content studio" };

export default function AdminPage() {
  return <AdminOverview />;
}

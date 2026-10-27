import type { Metadata } from "next";
import { TeacherClasses } from "@/components/staff/classes";

export const metadata: Metadata = { title: "My classes" };

export default function TeacherPage() {
  return <TeacherClasses />;
}

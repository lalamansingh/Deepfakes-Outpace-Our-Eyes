import type { ReactNode } from "react";
import { StaffAuthProvider } from "@/components/staff/auth";
import { StaffShell } from "@/components/staff/shell";

export default function StaffAppLayout({ children }: { children: ReactNode }) {
  return (
    <StaffAuthProvider>
      <StaffShell>{children}</StaffShell>
    </StaffAuthProvider>
  );
}

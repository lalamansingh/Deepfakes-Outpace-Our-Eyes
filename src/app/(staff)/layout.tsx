import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Staff", template: "%s · Staff · Real or Rendered?" },
  robots: { index: false, follow: false },
};

export default function StaffRootLayout({ children }: { children: ReactNode }) {
  return children;
}

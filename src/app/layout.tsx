import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Real or Rendered?", template: "%s · Real or Rendered?" },
  description: "A 5-minute daily game that trains you to spot AI-generated images, voices and videos.",
  applicationName: "Real or Rendered?",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#1c091c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

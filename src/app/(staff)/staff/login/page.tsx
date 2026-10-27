import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame, LoginForm } from "@/components/staff/auth-forms";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthFrame title="Sign in to the staff area" subtitle="For teachers and content curators.">
      <Suspense>
        <LoginForm />
      </Suspense>
    </AuthFrame>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthFrame, RegisterForm } from "@/components/staff/auth-forms";

export const metadata: Metadata = { title: "Create a teacher account" };

export default function RegisterPage() {
  return (
    <AuthFrame title="Create a teacher account" subtitle="Free for schools. Set up a class in under a minute.">
      <Suspense>
        <RegisterForm />
      </Suspense>
    </AuthFrame>
  );
}

import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/shared/forgot-password-form";

export const metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-element py-section">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </main>
  );
}

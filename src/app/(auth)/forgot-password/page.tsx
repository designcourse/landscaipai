import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/shared/forgot-password-form";

export const metadata = { title: "Forgot Password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-element">
      <Suspense>
        <ForgotPasswordForm />
      </Suspense>
    </main>
  );
}

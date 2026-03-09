import { ResetPasswordForm } from "@/components/shared/reset-password-form";

export const metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-element">
      <ResetPasswordForm />
    </main>
  );
}

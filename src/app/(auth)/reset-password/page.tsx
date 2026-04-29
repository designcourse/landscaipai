import { ResetPasswordForm } from "@/components/shared/reset-password-form";

export const metadata = { title: "Reset Password" };

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-element py-section">
      <ResetPasswordForm />
    </main>
  );
}

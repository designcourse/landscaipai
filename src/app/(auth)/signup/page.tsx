import { AuthForm } from "@/components/shared/auth-form";

export const metadata = { title: "Sign Up" };

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-element">
      <AuthForm mode="signup" />
    </main>
  );
}

import { AuthForm } from "@/components/shared/auth-form";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <main className="flex min-h-[calc(100vh-64px)] items-center justify-center px-element py-section">
      <AuthForm mode="login" />
    </main>
  );
}

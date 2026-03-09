import { AuthForm } from "@/components/shared/auth-form";

export const metadata = { title: "Sign In" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-element">
      <AuthForm mode="login" />
    </main>
  );
}

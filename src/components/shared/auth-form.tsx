"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isDisposableEmailDomain } from "@/lib/utils/email";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  mode: AuthMode;
  variant?: "page" | "modal";
  onSwitchMode?: () => void;
  onSuccess?: () => void;
}

export function AuthForm({
  mode,
  variant = "page",
  onSwitchMode,
  onSuccess,
}: AuthFormProps) {
  const isModal = variant === "modal";
  const googleBg = isModal ? "bg-white" : "bg-background";
  const inputBg = isModal ? "bg-white" : "bg-background";
  const inputAutofill = isModal ? " no-autofill-tint" : "";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isLogin = mode === "login";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
    } else {
      if (isDisposableEmailDomain(email)) {
        setError("Please use a permanent email address — disposable/temporary email providers aren't supported.");
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        setError("An account with this email already exists. Try signing in instead.");
        setLoading(false);
        return;
      }
      if (!data.session) {
        setInfo("Account created — check your email for a confirmation link to finish signing in.");
        setLoading(false);
        return;
      }
    }

    onSuccess?.();
    router.push("/dashboard");
    router.refresh();
  }

  async function handleGoogleAuth() {
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      setError(error.message);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isLogin
            ? "Sign in to your Landscaip account"
            : "Start visualizing your dream landscape"}
        </p>
      </div>

      <button
        type="button"
        onClick={handleGoogleAuth}
        className={`flex w-full cursor-pointer items-center justify-center gap-tight rounded-sm border border-border ${googleBg} px-4 py-2.5 text-sm font-medium text-foreground`}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-foreground"
            >
              Full name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={`mt-1 block w-full rounded-md border border-border ${inputBg} px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary${inputAutofill}`}
              placeholder="Jane Smith"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-foreground"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`mt-1 block w-full rounded-md border border-border ${inputBg} px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary${inputAutofill}`}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`mt-1 block w-full rounded-md border border-border ${inputBg} px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary${inputAutofill}`}
            placeholder="At least 6 characters"
          />
        </div>

        {isLogin && (
          <div className="flex justify-end">
            <a
              href="/forgot-password"
              className="text-sm text-primary hover:text-primary-light"
            >
              Forgot password?
            </a>
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {info && (
          <p className="text-sm text-success">{info}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {loading
            ? isLogin
              ? "Signing in..."
              : "Creating account..."
            : isLogin
              ? "Sign in"
              : "Create account"}
        </button>

        {!isLogin && (
          <p className="text-center text-xs text-muted-foreground">
            By creating an account, you agree to our{" "}
            <a
              href="/terms"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              Privacy Policy
            </a>
            .
          </p>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        {onSwitchMode ? (
          <button
            type="button"
            onClick={onSwitchMode}
            className="font-medium text-primary hover:text-primary-light"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        ) : (
          <a
            href={isLogin ? "/signup" : "/login"}
            className="font-medium text-primary hover:text-primary-light"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </a>
        )}
      </p>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";

type AccountProfile = Pick<
  Profile,
  "id" | "email" | "full_name" | "credits_balance" | "avatar_url" | "user_type"
>;

export function AccountSettings({
  user,
  profile,
}: {
  user: User;
  profile: AccountProfile;
}) {
  const supabase = useMemo(() => createClient(), []);

  // Email change
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  // Password change
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault();
    setEmailError(null);
    setEmailSuccess(null);
    setEmailLoading(true);

    const { error } = await supabase.auth.updateUser({ email: newEmail });

    setEmailLoading(false);

    if (error) {
      setEmailError(error.message);
      return;
    }

    setEmailSuccess("Confirmation sent to your new email address.");
    setNewEmail("");
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setPasswordLoading(false);

    if (error) {
      setPasswordError(error.message);
      return;
    }

    setPasswordSuccess("Password updated successfully.");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="mx-auto max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your email and password
        </p>
      </div>

      {/* Change Email */}
      <form onSubmit={handleEmailChange} className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Email</h2>
        <p className="text-sm text-muted-foreground">
          Current email: <span className="text-foreground">{user.email}</span>
        </p>

        <div>
          <label
            htmlFor="newEmail"
            className="block text-sm font-medium text-foreground"
          >
            New email
          </label>
          <input
            id="newEmail"
            type="email"
            required
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="new@example.com"
          />
        </div>

        {emailError && <p className="text-sm text-destructive">{emailError}</p>}
        {emailSuccess && (
          <p className="text-sm text-primary">{emailSuccess}</p>
        )}

        <button
          type="submit"
          disabled={emailLoading}
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {emailLoading ? "Updating..." : "Update email"}
        </button>
      </form>

      <div className="border-t border-border" />

      {/* Change Password */}
      <form onSubmit={handlePasswordChange} className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Password</h2>

        <div>
          <label
            htmlFor="accountNewPassword"
            className="block text-sm font-medium text-foreground"
          >
            New password
          </label>
          <input
            id="accountNewPassword"
            type="password"
            required
            minLength={6}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="At least 6 characters"
          />
        </div>

        <div>
          <label
            htmlFor="accountConfirmPassword"
            className="block text-sm font-medium text-foreground"
          >
            Confirm password
          </label>
          <input
            id="accountConfirmPassword"
            type="password"
            required
            minLength={6}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Repeat your password"
          />
        </div>

        {passwordError && (
          <p className="text-sm text-destructive">{passwordError}</p>
        )}
        {passwordSuccess && (
          <p className="text-sm text-primary">{passwordSuccess}</p>
        )}

        <button
          type="submit"
          disabled={passwordLoading}
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {passwordLoading ? "Updating..." : "Update password"}
        </button>
      </form>
    </div>
  );
}

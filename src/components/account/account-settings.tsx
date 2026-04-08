"use client";

import { useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { BUCKET_COMPANY_LOGOS, getCompanyLogoPath } from "@/lib/utils/storage";
import type { User } from "@supabase/supabase-js";
import type { CompanySettings } from "@/types";

const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const NOTE_MAX_LENGTH = 500;

const LOGO_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
  "image/jpeg": "jpg",
};

export function AccountSettings({
  user,
  companySettings,
  initialLogoUrl,
}: {
  user: User;
  companySettings: CompanySettings | null;
  initialLogoUrl: string | null;
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

  // Company branding (landscaper/admin only)
  const [companyName, setCompanyName] = useState(
    companySettings?.company_name ?? ""
  );
  const [companyPhone, setCompanyPhone] = useState(
    companySettings?.company_phone ?? ""
  );
  const [defaultNote, setDefaultNote] = useState(
    companySettings?.default_note ?? ""
  );
  const [logoPath, setLogoPath] = useState<string | null>(
    companySettings?.logo_path ?? null
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl);
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSuccess, setBrandingSuccess] = useState<string | null>(null);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

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

  async function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file still triggers change
    if (logoInputRef.current) logoInputRef.current.value = "";
    if (!file) return;

    setBrandingError(null);
    setBrandingSuccess(null);

    if (file.size > LOGO_MAX_BYTES) {
      setBrandingError("Logo must be 2 MB or less.");
      return;
    }

    const ext = LOGO_EXT_BY_MIME[file.type];
    if (!ext) {
      setBrandingError("Logo must be PNG, SVG, WebP, or JPG.");
      return;
    }

    setLogoUploading(true);

    // If the previous logo had a different extension, remove it so we don't
    // leak orphaned files in the bucket.
    if (logoPath && !logoPath.endsWith(`.${ext}`)) {
      await supabase.storage.from(BUCKET_COMPANY_LOGOS).remove([logoPath]);
    }

    const newPath = getCompanyLogoPath(user.id, ext);
    const { error: uploadError } = await supabase.storage
      .from(BUCKET_COMPANY_LOGOS)
      .upload(newPath, file, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      setLogoUploading(false);
      setBrandingError(uploadError.message);
      return;
    }

    const { data: urlData } = await supabase.storage
      .from(BUCKET_COMPANY_LOGOS)
      .createSignedUrl(newPath, 4 * 60 * 60);

    setLogoPath(newPath);
    setLogoUrl(urlData?.signedUrl ?? null);
    setLogoUploading(false);
  }

  async function handleBrandingSave(e: React.FormEvent) {
    e.preventDefault();
    setBrandingError(null);
    setBrandingSuccess(null);
    setBrandingSaving(true);

    const { error } = await supabase
      .from("company_settings")
      .upsert(
        {
          user_id: user.id,
          company_name: companyName.trim() || null,
          company_phone: companyPhone.trim() || null,
          logo_path: logoPath,
          default_note: defaultNote.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    setBrandingSaving(false);

    if (error) {
      setBrandingError(error.message);
      return;
    }

    setBrandingSuccess("Branding saved.");
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

      <div className="border-t border-border" />

      <form
        id="branding"
        onSubmit={handleBrandingSave}
        className="scroll-mt-section space-y-4"
      >
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Are you a landscaper? Enter your details below
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These details appear on the closing screen when you finalize a
            video to send to clients.
          </p>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-foreground">
            Company logo
          </label>
          <div className="mt-2 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border border-border bg-white p-1">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt="Company logo"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-xs text-muted-foreground">No logo</span>
              )}
            </div>
            <button
              type="button"
              disabled={logoUploading}
              onClick={() => logoInputRef.current?.click()}
              className="rounded-sm border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {logoUploading
                ? "Uploading..."
                : logoUrl
                  ? "Replace logo"
                  : "Upload logo"}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/webp,image/jpeg"
              onChange={handleLogoSelect}
              className="hidden"
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            PNG, SVG, WebP, or JPG. Max 2 MB.
          </p>
        </div>

        {/* Company name */}
        <div>
          <label
            htmlFor="companyName"
            className="block text-sm font-medium text-foreground"
          >
            Company name
          </label>
          <input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Greenleaf Landscaping"
            maxLength={100}
          />
        </div>

        {/* Phone */}
        <div>
          <label
            htmlFor="companyPhone"
            className="block text-sm font-medium text-foreground"
          >
            Phone
          </label>
          <input
            id="companyPhone"
            type="tel"
            value={companyPhone}
            onChange={(e) => setCompanyPhone(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="(555) 123-4567"
            maxLength={30}
          />
        </div>

        {/* Default closing note */}
        <div>
          <label
            htmlFor="defaultNote"
            className="block text-sm font-medium text-foreground"
          >
            Default closing note
          </label>
          <textarea
            id="defaultNote"
            value={defaultNote}
            onChange={(e) =>
              setDefaultNote(e.target.value.slice(0, NOTE_MAX_LENGTH))
            }
            rows={3}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Contact us today and we can make this happen."
            maxLength={NOTE_MAX_LENGTH}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {defaultNote.length}/{NOTE_MAX_LENGTH} characters. Used as the
            default note when finalizing a video; can be edited per video.
          </p>
        </div>

        {brandingError && (
          <p className="text-sm text-destructive">{brandingError}</p>
        )}
        {brandingSuccess && (
          <p className="text-sm text-primary">{brandingSuccess}</p>
        )}

        <button
          type="submit"
          disabled={brandingSaving}
          className="rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50"
        >
          {brandingSaving ? "Saving..." : "Save branding"}
        </button>
      </form>
    </div>
  );
}

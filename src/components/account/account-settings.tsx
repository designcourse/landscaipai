"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

const cardClass =
  "rounded-lg border border-border bg-white p-group shadow-sm";
const inputClass =
  "mt-1 block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";
const labelClass = "block text-sm font-medium text-foreground";
const primaryBtn =
  "cursor-pointer rounded-sm bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-light disabled:opacity-50";
const secondaryBtn =
  "cursor-pointer rounded-sm border border-border bg-white px-3 py-2 text-sm font-medium text-foreground transition-colors disabled:opacity-50";
const dangerBtn =
  "cursor-pointer rounded-sm bg-destructive px-4 py-2.5 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50";

export function AccountSettings({
  user,
  companySettings,
  initialLogoUrl,
}: {
  user: User;
  companySettings: CompanySettings | null;
  initialLogoUrl: string | null;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  async function handleDeleteAccount() {
    setDeleteError(null);
    setDeleteLoading(true);

    const res = await fetch("/api/account", { method: "DELETE" });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDeleteError(body.error || "Failed to delete account.");
      setDeleteLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-section">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Account settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your email, password, branding, and account.
        </p>
      </div>

      <section className={cardClass}>
        <header className="mb-element">
          <h2 className="text-lg font-semibold text-foreground">Email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Current email:{" "}
            <span className="text-foreground">{user.email}</span>
          </p>
        </header>

        <form onSubmit={handleEmailChange} className="space-y-4">
          <div>
            <label htmlFor="newEmail" className={labelClass}>
              New email
            </label>
            <input
              id="newEmail"
              type="email"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className={inputClass}
              placeholder="new@example.com"
            />
          </div>

          {emailError && (
            <p className="text-sm text-destructive">{emailError}</p>
          )}
          {emailSuccess && (
            <p className="text-sm text-success">{emailSuccess}</p>
          )}

          <button type="submit" disabled={emailLoading} className={primaryBtn}>
            {emailLoading ? "Updating..." : "Update email"}
          </button>
        </form>
      </section>

      <section className={cardClass}>
        <header className="mb-element">
          <h2 className="text-lg font-semibold text-foreground">Password</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a strong password — at least 6 characters.
          </p>
        </header>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label htmlFor="accountNewPassword" className={labelClass}>
              New password
            </label>
            <input
              id="accountNewPassword"
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
              placeholder="At least 6 characters"
            />
          </div>

          <div>
            <label htmlFor="accountConfirmPassword" className={labelClass}>
              Confirm password
            </label>
            <input
              id="accountConfirmPassword"
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="Repeat your password"
            />
          </div>

          {passwordError && (
            <p className="text-sm text-destructive">{passwordError}</p>
          )}
          {passwordSuccess && (
            <p className="text-sm text-success">{passwordSuccess}</p>
          )}

          <button
            type="submit"
            disabled={passwordLoading}
            className={primaryBtn}
          >
            {passwordLoading ? "Updating..." : "Update password"}
          </button>
        </form>
      </section>

      <section id="branding" className={`${cardClass} scroll-mt-section`}>
        <header className="mb-element">
          <h2 className="text-lg font-semibold text-foreground">
            Landscaper branding
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            These details appear on the closing screen when you finalize a
            video to send to clients.
          </p>
        </header>

        <form onSubmit={handleBrandingSave} className="space-y-4">
          <div>
            <label className={labelClass}>Company logo</label>
            <div className="mt-2 flex items-center gap-element">
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
                className={secondaryBtn}
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

          <div>
            <label htmlFor="companyName" className={labelClass}>
              Company name
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className={inputClass}
              placeholder="Greenleaf Landscaping"
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="companyPhone" className={labelClass}>
              Phone
            </label>
            <input
              id="companyPhone"
              type="tel"
              value={companyPhone}
              onChange={(e) => setCompanyPhone(e.target.value)}
              className={inputClass}
              placeholder="(555) 123-4567"
              maxLength={30}
            />
          </div>

          <div>
            <label htmlFor="defaultNote" className={labelClass}>
              Default closing note
            </label>
            <textarea
              id="defaultNote"
              value={defaultNote}
              onChange={(e) =>
                setDefaultNote(e.target.value.slice(0, NOTE_MAX_LENGTH))
              }
              rows={3}
              className={inputClass}
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
            <p className="text-sm text-success">{brandingSuccess}</p>
          )}

          <button
            type="submit"
            disabled={brandingSaving}
            className={primaryBtn}
          >
            {brandingSaving ? "Saving..." : "Save branding"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-destructive/40 bg-white p-group shadow-sm">
        <header className="mb-element">
          <h2 className="text-lg font-semibold text-destructive">
            Danger zone
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete your account and all associated data. This
            cannot be undone.
          </p>
        </header>

        <button
          type="button"
          onClick={() => {
            setDeleteError(null);
            setDeleteOpen(true);
          }}
          className={dangerBtn}
        >
          Delete account
        </button>
      </section>

      {deleteOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-element"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleteLoading && setDeleteOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-md rounded-lg bg-white p-group shadow-lg">
            <h3 className="text-lg font-semibold text-foreground">
              Delete your account?
            </h3>
            <p className="mt-tight text-sm text-muted-foreground">
              All projects, uploads, generations, and credits will be
              permanently deleted. This action cannot be undone.
            </p>

            {deleteError && (
              <p className="mt-element text-sm text-destructive">
                {deleteError}
              </p>
            )}

            <div className="mt-group flex justify-end gap-tight">
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                disabled={deleteLoading}
                className={secondaryBtn}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                className={dangerBtn}
              >
                {deleteLoading ? "Deleting..." : "Yes, delete my account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types";

type NavbarProfile = Pick<Profile, "full_name" | "credits_balance" | "avatar_url" | "email"> | null;

interface NavbarClientProps {
  user: { id: string; email: string } | null;
  profile: NavbarProfile;
}

function Avatar({ url, initials }: { url: string | null; initials: string }) {
  if (url) {
    return (
      <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
      {initials}
    </span>
  );
}

export function NavbarClient({ user, profile }: NavbarClientProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const displayName = profile?.full_name || profile?.email || user?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-element">
        {/* Logo */}
        <Link
          href={user ? "/dashboard" : "/"}
          className="text-lg font-bold text-primary"
        >
          Landscaip
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {user && (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>

              {/* Credits badge */}
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                {profile?.credits_balance ?? 0} credits
              </span>

              {/* User dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-full transition-colors hover:bg-muted"
                >
                  <Avatar url={profile?.avatar_url ?? null} initials={initials} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-md border border-border bg-background shadow-md">
                    <div className="border-b border-border px-4 py-3">
                      <p className="text-sm font-medium text-foreground truncate">
                        {displayName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {profile?.email || user.email}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/account"
                        className="block px-4 py-2 text-sm text-foreground hover:bg-muted"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Account settings
                      </Link>
                      <button
                        onClick={handleSignOut}
                        className="block w-full px-4 py-2 text-left text-sm text-destructive hover:bg-muted"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {!user && (
            <>
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium text-foreground transition-colors hover:text-primary"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-light"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-8 w-8 items-center justify-center rounded-md md:hidden hover:bg-muted"
          aria-label="Toggle menu"
        >
          <svg
            className="h-5 w-5 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-border px-element pb-4 pt-2 md:hidden">
          {user ? (
            <div className="space-y-1">
              <div className="flex items-center gap-3 py-2">
                <Avatar url={profile?.avatar_url ?? null} initials={initials} />
                <div>
                  <p className="text-sm font-medium text-foreground">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.credits_balance ?? 0} credits
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/pricing"
                className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/account"
                className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Account settings
              </Link>
              <button
                onClick={handleSignOut}
                className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-1">
              <Link
                href="/pricing"
                className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/login"
                className="block rounded-md px-3 py-2 text-sm text-foreground hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="block rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
                onClick={() => setMobileOpen(false)}
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

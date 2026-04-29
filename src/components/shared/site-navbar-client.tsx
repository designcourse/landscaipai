"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuthModal } from "./auth-modal-context";
import type { Profile } from "@/types";

type NavbarProfile = Pick<
  Profile,
  "full_name" | "credits_balance" | "avatar_url" | "email"
> | null;

interface SiteNavbarClientProps {
  user: { id: string; email: string } | null;
  profile: NavbarProfile;
}

const NAV_LINKS = [
  { label: "Gallery", href: "/#gallery" },
  { label: "Pricing", href: "/#pricing" },
  { label: "For landscapers", href: "/#audience" },
  { label: "FAQ", href: "/#faq" },
];

function Avatar({ url, initials }: { url: string | null; initials: string }) {
  const [failed, setFailed] = useState(false);
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-8 w-8 rounded-full object-cover"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-white">
      {initials}
    </span>
  );
}

export function SiteNavbarClient({ user, profile }: SiteNavbarClientProps) {
  const router = useRouter();
  const { openModal } = useAuthModal();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function closeMobile() {
    setMobileOpen(false);
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const displayName =
    profile?.full_name || profile?.email || user?.email || "";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <nav className="site-nav">
      <Link href="/" aria-label="Landscaip" className="site-nav-brand">
        <Image
          src="/landing/logo.png"
          alt="Landscaip"
          width={128}
          height={20}
          className="site-nav-logo"
          priority
        />
      </Link>

      <div className="site-nav-links">
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </div>

      <div className="site-nav-right">
        {user ? (
          <>
            <span className="site-nav-credits">
              <span className="dot" aria-hidden="true" />
              <span className="n">{profile?.credits_balance ?? 0}</span>
              <span className="lbl">credits</span>
            </span>
            <Link href="/dashboard" className="btn btn-ghost btn-sm">
              Dashboard
            </Link>
            <div className="site-nav-user" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="site-nav-avatar-btn"
                aria-label="User menu"
              >
                <Avatar
                  url={profile?.avatar_url ?? null}
                  initials={initials}
                />
              </button>
              {dropdownOpen && (
                <div className="site-nav-dropdown" role="menu">
                  <div className="site-nav-dropdown-head">
                    <p className="name">{displayName}</p>
                    <p className="email">{profile?.email || user.email}</p>
                  </div>
                  <Link
                    href="/dashboard"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/account"
                    onClick={() => setDropdownOpen(false)}
                    role="menuitem"
                  >
                    Account settings
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="danger"
                    role="menuitem"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openModal("login")}
              className="btn btn-ghost btn-sm"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openModal("signup")}
              className="btn btn-primary btn-sm"
            >
              Get started
            </button>
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="site-nav-burger"
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {mobileOpen ? (
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M6 6l12 12M18 6L6 18"
            />
          ) : (
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              d="M4 7h16M4 12h16M4 17h16"
            />
          )}
        </svg>
      </button>

      {mobileOpen && (
        <div className="site-nav-mobile" role="dialog" aria-label="Mobile menu">
          {user && (
            <div className="site-nav-mobile-user">
              <Avatar
                url={profile?.avatar_url ?? null}
                initials={initials}
              />
              <div>
                <p className="name">{displayName}</p>
                <p className="meta">
                  {profile?.credits_balance ?? 0} credits
                </p>
              </div>
            </div>
          )}
          <div className="site-nav-mobile-links">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} onClick={closeMobile}>
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link href="/dashboard" onClick={closeMobile}>
                  Dashboard
                </Link>
                <Link href="/account" onClick={closeMobile}>
                  Account settings
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    handleSignOut();
                  }}
                  className="danger"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    openModal("login");
                  }}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  className="primary"
                  onClick={() => {
                    closeMobile();
                    openModal("signup");
                  }}
                >
                  Get started
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

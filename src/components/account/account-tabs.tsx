"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Account Settings", href: "/account" },
  { label: "Billing History", href: "/account/billing" },
];

export function AccountTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-panel-input-border">
      <nav className="flex gap-group" aria-label="Account sections">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`-mb-px border-b-2 pb-3 text-sm transition-colors ${
                isActive
                  ? "border-primary font-semibold text-primary"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

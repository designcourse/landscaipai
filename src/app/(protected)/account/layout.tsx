import { AccountTabs } from "@/components/account/account-tabs";

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="px-element py-section">
      <div className="mx-auto w-full max-w-[1280px] space-y-element">
        <header className="space-y-tight">
          <h1 className="text-2xl font-bold text-foreground">
            Account settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your email, password, branding, and account.
          </p>
        </header>
        <AccountTabs />
        {children}
      </div>
    </main>
  );
}

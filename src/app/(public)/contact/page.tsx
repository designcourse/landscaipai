import Link from "next/link";

export const metadata = {
  title: "Contact — Landscaip",
  description:
    "Get in touch with the Landscaip team for support, billing questions, or feedback.",
};

export default function ContactPage() {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl px-element py-section">
        <header className="mb-group">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Contact us
          </h1>
          <p className="mt-tight text-base text-muted-foreground">
            We read every message. Most replies go out within one business day.
          </p>
        </header>

        <div className="grid gap-element sm:grid-cols-2">
          <ContactCard
            title="Support"
            blurb="Trouble signing in, missing credits, generation issues, or anything else broken."
            email="support@landscaip.co"
          />
          <ContactCard
            title="Billing"
            blurb="Refunds within the eligible window, receipts, or questions about a charge."
            email="support@landscaip.co"
          />
          <ContactCard
            title="Press &amp; partnerships"
            blurb="Interviews, partnership ideas, integration requests, or media inquiries."
            email="hello@landscaip.co"
          />
          <ContactCard
            title="Security &amp; legal"
            blurb="Report a vulnerability, request data, or send a legal notice."
            email="hello@landscaip.co"
          />
        </div>

        <div className="mt-group rounded-lg border border-border bg-white p-element">
          <h2 className="text-lg font-semibold text-foreground">
            Before you email
          </h2>
          <p className="mt-tight text-sm text-muted-foreground">
            Quick answers may be in our{" "}
            <Link href="/faq" className="text-primary hover:underline">
              FAQ
            </Link>
            , and the latest pricing is on our{" "}
            <Link href="/pricing" className="text-primary hover:underline">
              pricing page
            </Link>
            . For account-related requests please email us from the address on
            your Landscaip account so we can verify ownership.
          </p>
        </div>
      </div>
    </main>
  );
}

function ContactCard({
  title,
  blurb,
  email,
}: {
  title: string;
  blurb: string;
  email: string;
}) {
  return (
    <div className="flex flex-col gap-tight rounded-lg border border-border bg-white p-element">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="flex-1 text-sm text-muted-foreground">{blurb}</p>
      <a
        href={`mailto:${email}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        {email}
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>
    </div>
  );
}

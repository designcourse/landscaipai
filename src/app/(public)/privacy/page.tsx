import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Landscaip",
  description:
    "How Landscaip collects, uses, and protects your personal information.",
};

const EFFECTIVE_DATE = "May 20, 2026";

export default function PrivacyPage() {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl px-element py-section">
        <header className="mb-group">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-tight text-sm text-muted-foreground">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <div className="space-y-group text-foreground">
          <Section title="1. Who we are">
            <p>
              This Privacy Policy explains how Landscaip (&ldquo;Landscaip,&rdquo;
              &ldquo;we,&rdquo; &ldquo;our&rdquo;) collects, uses, and shares
              information when you use our website and the Landscaip AI
              landscape design service (the &ldquo;Service&rdquo;). By using
              the Service you agree to the practices described in this Policy
              and our{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms of Service
              </Link>
              .
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>We collect the following categories of information:</p>
            <ul className="ml-5 mt-tight list-disc space-y-1">
              <li>
                <strong>Account information.</strong> Your name, email
                address, and password hash when you create an account. If you
                sign in with Google we receive your name, email, profile image
                URL, and a Google account identifier.
              </li>
              <li>
                <strong>User Content.</strong> Photos, project names, ZIP
                codes / hardiness zones, custom prompts, in-painting masks,
                and other inputs you submit to the Service.
              </li>
              <li>
                <strong>Generation data.</strong> Style presets, settings
                (time of day, season, weather), selected library items, AI
                model choices, and the resulting renderings and videos.
              </li>
              <li>
                <strong>Billing information.</strong> When you purchase
                credits, our payment processor (Stripe) collects your payment
                details. We receive billing email, last 4 digits, country, ZIP
                code, and a Stripe customer / charge identifier. We do not
                store full card numbers.
              </li>
              <li>
                <strong>Usage and device data.</strong> IP address, browser
                user-agent, timestamps, pages viewed, feature usage, error
                logs, and basic device characteristics. Hosting and serverless
                logs are retained for a limited period to debug and secure the
                Service.
              </li>
              <li>
                <strong>Cookies.</strong> Strictly-necessary cookies used to
                keep you signed in and to maintain checkout sessions.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use information">
            <p>We use the information we collect to:</p>
            <ul className="ml-5 mt-tight list-disc space-y-1">
              <li>Provide and operate the Service (host photos, generate renderings, manage credits, deliver downloads).</li>
              <li>Process payments and prevent fraudulent charges.</li>
              <li>Authenticate users and secure accounts.</li>
              <li>Send transactional emails (signup confirmation, receipts, account notices).</li>
              <li>Respond to support requests and provide customer service.</li>
              <li>Diagnose bugs, monitor performance, and improve reliability.</li>
              <li>Comply with legal obligations, enforce our Terms, and protect users.</li>
            </ul>
            <p className="mt-tight">
              We do <strong>not</strong> sell your personal information. We do
              not use your User Content or Output to train AI models for
              ourselves or third parties.
            </p>
          </Section>

          <Section title="4. Sub-processors and sharing">
            <p>
              We share data with the following service providers as needed to
              run the Service:
            </p>
            <ul className="ml-5 mt-tight list-disc space-y-1">
              <li>
                <strong>Stripe, Inc.</strong> — Payment processing.{" "}
                <a
                  href="https://stripe.com/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Supabase, Inc.</strong> — Database, authentication,
                and private object storage (uploads, renderings, videos).{" "}
                <a
                  href="https://supabase.com/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Google LLC</strong> — AI image and video generation
                via the Gemini and Veo APIs. Your prompts and uploaded photos
                are transmitted to Google to produce renderings.{" "}
                <a
                  href="https://policies.google.com/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                . When signing in with Google, Google also acts as an identity
                provider.
              </li>
              <li>
                <strong>Vercel Inc.</strong> — Hosting and serverless function
                runtime.{" "}
                <a
                  href="https://vercel.com/legal/privacy-policy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Twilio Inc.</strong> — SMS text messaging to customers
                who have opted in (reminders, quotes, invoices).{" "}
                <a
                  href="https://www.twilio.com/legal/privacy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </li>
              <li>
                <strong>Resend</strong> — Transactional email delivery.{" "}
                <a
                  href="https://resend.com/legal/privacy-policy"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Privacy Policy
                </a>
                .
              </li>
            </ul>
            <p className="mt-tight">
              <strong>
                We do not sell your personal information, and we never share
                your mobile phone number or SMS opt-in consent with third
                parties or affiliates for their own marketing.
              </strong>{" "}
              Text-message consent you give to a landscaper is used only to send
              you service messages from that business — it is not shared for any
              other purpose.
            </p>
            <p className="mt-tight">
              We may also disclose information when required by law, to
              enforce our Terms, to protect the rights, safety, and property
              of Landscaip or others, or in connection with a corporate
              transaction such as a merger or acquisition (in which case the
              acquirer will be bound by this Policy unless you are notified
              and given a chance to opt out).
            </p>
          </Section>

          <Section title="5. AI processing">
            <p>
              When you generate a rendering or video, the source photo, your
              prompt, style preset, and settings are sent to a third-party AI
              provider (currently Google) for processing. The Output is
              returned to us, stored in your account, and made available for
              you to download. Per Google&rsquo;s API terms in effect, data
              submitted via paid Gemini API endpoints is not used to train
              Google&rsquo;s general-purpose models. Provider terms may change
              over time; we will update this Policy if a new sub-processor is
              added.
            </p>
          </Section>

          <Section title="6. Data retention">
            <p>
              We retain your account, projects, uploads, and renderings for as
              long as your account is active. You may delete individual
              images, generations, or your entire account at any time, after
              which the corresponding files are removed from our active
              systems within a reasonable period. Routine backups may retain
              residual copies for up to thirty (30) days before being
              overwritten. Logs and billing records are retained as required
              for tax, accounting, and security purposes (typically up to
              seven years).
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>
              Depending on where you live you may have certain rights over
              your personal information, including the right to:
            </p>
            <ul className="ml-5 mt-tight list-disc space-y-1">
              <li>Access the personal information we hold about you.</li>
              <li>Correct inaccurate information.</li>
              <li>Delete your information (subject to legal retention obligations).</li>
              <li>Export a copy of your information in a portable format.</li>
              <li>
                Object to or restrict certain processing, including
                opting out of marketing emails (we currently only send
                transactional emails).
              </li>
            </ul>
            <p className="mt-tight">
              California residents have additional rights under the CCPA / CPRA,
              including the right to know, the right to delete, and the right
              to non-discrimination for exercising those rights. EEA and UK
              residents have rights under the GDPR / UK GDPR, including the
              right to lodge a complaint with a supervisory authority. To
              exercise any of these rights, email{" "}
              <a
                href="mailto:support@landscaip.co"
                className="text-primary hover:underline"
              >
                support@landscaip.co
              </a>{" "}
              from the email address on your account.
            </p>
          </Section>

          <Section title="8. Children">
            <p>
              The Service is not directed to children under 13 (or 16 in the
              EEA / UK). We do not knowingly collect personal information from
              children. If you believe we have inadvertently collected
              information from a child, please contact us and we will delete
              it.
            </p>
          </Section>

          <Section title="9. International transfers">
            <p>
              Landscaip is operated from the United States. Sub-processors may
              also be based outside your country. When personal information is
              transferred across borders we rely on appropriate safeguards
              including standard contractual clauses where applicable.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              We use industry-standard practices to protect your data,
              including encryption in transit (TLS), private object storage
              with row-level access control, hashed passwords (via Supabase
              Auth), and least-privilege service credentials. No method of
              transmission or storage is 100% secure; in the event of a
              security incident affecting your data we will notify you in
              accordance with applicable law.
            </p>
          </Section>

          <Section title="11. Changes to this Policy">
            <p>
              We may update this Policy from time to time. If we make material
              changes we will update the Effective date and, where reasonable,
              notify you by email or in-product notice. Continued use of the
              Service after changes take effect constitutes acceptance.
            </p>
          </Section>

          <Section title="12. Contact us">
            <p>
              Questions about this Policy or how we handle your data? Email{" "}
              <a
                href="mailto:support@landscaip.co"
                className="text-primary hover:underline"
              >
                support@landscaip.co
              </a>{" "}
              or visit our{" "}
              <Link href="/contact" className="text-primary hover:underline">
                contact page
              </Link>
              .
            </p>
          </Section>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-tight text-xl font-semibold text-foreground">
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-foreground/80">
        {children}
      </div>
    </section>
  );
}

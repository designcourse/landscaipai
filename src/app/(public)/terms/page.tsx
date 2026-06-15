import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Landscaip",
  description:
    "The terms that govern your use of Landscaip's AI landscape design service.",
};

const EFFECTIVE_DATE = "May 20, 2026";

export default function TermsPage() {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl px-element py-section">
        <header className="mb-group">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Terms of Service
          </h1>
          <p className="mt-tight text-sm text-muted-foreground">
            Effective {EFFECTIVE_DATE}
          </p>
        </header>

        <div className="space-y-group text-foreground">
          <Section title="1. Agreement to terms">
            <p>
              These Terms of Service (the &ldquo;Terms&rdquo;) govern your
              access to and use of the Landscaip website, mobile experience,
              and related services (collectively, the &ldquo;Service&rdquo;).
              The Service is operated by Landscaip (&ldquo;Landscaip,&rdquo;
              &ldquo;we,&rdquo; &ldquo;our&rdquo;). By creating an account or
              using the Service you agree to be bound by these Terms and our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              . If you do not agree, do not use the Service.
            </p>
          </Section>

          <Section title="2. Who can use the Service">
            <p>
              You must be at least 18 years old (or the age of majority in your
              jurisdiction) to create an account. You are responsible for the
              accuracy of the information you provide and for all activity that
              occurs under your account. Keep your login credentials
              confidential and notify us immediately if you suspect
              unauthorized access.
            </p>
          </Section>

          <Section title="3. The Service">
            <p>
              Landscaip is an AI-assisted landscape design tool. You upload
              photographs of outdoor spaces and use our tools to generate
              edited renderings, in-painted variations, and short videos. The
              output is produced by third-party AI models and is provided for
              visualization and inspiration purposes only. We do not guarantee
              that any rendering is technically feasible, accurate to scale,
              compliant with local regulations, or representative of what a
              real installation will look like. Always confirm plant selection,
              site conditions, and construction details with a qualified
              landscape professional before acting on AI output.
            </p>
          </Section>

          <Section title="4. Credits and payments">
            <p>
              Most features of the Service consume credits. Credits are
              digital, non-monetary units of access that you may use within
              your Landscaip account. Credits are not currency, have no cash
              value, are non-transferable, and cannot be redeemed for money or
              exchanged outside the Service.
            </p>
            <ul className="ml-5 mt-tight list-disc space-y-1">
              <li>
                <strong>Free credits</strong> are granted on signup as a
                promotional benefit. The number of free credits and any
                associated limits may change at any time.
              </li>
              <li>
                <strong>Purchased credit packs</strong> are sold as one-time
                purchases. Prices, pack sizes, and contents are displayed on
                the{" "}
                <Link href="/pricing" className="text-primary hover:underline">
                  pricing page
                </Link>{" "}
                at the time of purchase. Pricing may change for future
                purchases; previously purchased credits are not affected.
              </li>
              <li>
                <strong>Credit expiration.</strong> Purchased credits do not
                expire unless required by law, your account is terminated for
                violation of these Terms, or the Service itself is
                discontinued.
              </li>
            </ul>
            <p className="mt-tight">
              Payments are processed by Stripe, Inc. By making a purchase you
              also agree to{" "}
              <a
                href="https://stripe.com/legal/consumer"
                className="text-primary hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Stripe&rsquo;s terms
              </a>
              . We do not store your full payment card details on our servers.
            </p>
          </Section>

          <Section title="5. Refunds">
            <p>
              Because credits are digital goods that are usable immediately, we
              do not provide refunds for credits that have been used. For
              unused credit packs, you may request a refund within{" "}
              <strong>seven (7) days</strong> of purchase by contacting{" "}
              <a
                href="mailto:support@landscaip.co"
                className="text-primary hover:underline"
              >
                support@landscaip.co
              </a>
              . Refund requests outside this window will generally not be
              honored except where required by applicable law. Refunds, if
              issued, are returned to the original payment method, may take
              several business days to appear, and result in the deduction of
              the corresponding credits from your balance.
            </p>
            <p className="mt-tight">
              If a generation fails due to a technical fault on our side
              (rather than a content policy rejection or invalid input), we
              automatically refund the credit consumed for that operation to
              your in-app balance.
            </p>
          </Section>

          <Section title="6. Your content">
            <p>
              You retain all rights to the photographs and other materials you
              upload (&ldquo;User Content&rdquo;). By uploading User Content
              you grant Landscaip a worldwide, non-exclusive, royalty-free
              license to host, store, process, transmit, display, and create
              derivative works from that content solely for the purpose of
              operating and improving the Service for you. You can delete your
              User Content at any time, which terminates this license going
              forward (except for backup copies retained for a reasonable
              period and copies you have shared publicly through Landscaip).
            </p>
            <p className="mt-tight">
              You represent and warrant that you have all necessary rights to
              upload your User Content and that it does not infringe the
              rights of any third party.
            </p>
          </Section>

          <Section title="7. AI-generated output">
            <p>
              Subject to your compliance with these Terms, you own the
              renderings and videos that the Service generates from your User
              Content (&ldquo;Output&rdquo;). You are free to download, share,
              and use Output for personal or commercial purposes.
            </p>
            <p className="mt-tight">
              Because the underlying AI models are probabilistic and trained
              on broad datasets, Output may resemble work produced by other
              users for unrelated inputs. We do not warrant the uniqueness,
              originality, or non-infringement of any specific Output. You are
              responsible for evaluating Output before using it.
            </p>
          </Section>

          <Section title="8. Acceptable use">
            <p>You agree not to:</p>
            <ul className="ml-5 mt-tight list-disc space-y-1">
              <li>
                Upload content you do not have the right to upload, including
                photos of property you do not own and have not been authorized
                to depict.
              </li>
              <li>
                Use the Service to generate content that is illegal, deceptive,
                hateful, harassing, sexually explicit, or that depicts
                identifiable individuals without their consent.
              </li>
              <li>
                Reverse-engineer, scrape, or attempt to extract the underlying
                models or proprietary system prompts.
              </li>
              <li>
                Use the Service to build a competing product, train a competing
                AI model, or otherwise circumvent these Terms.
              </li>
              <li>
                Abuse credit grants, fraudulently obtain credits, or interfere
                with billing, idempotency, or anti-fraud systems.
              </li>
              <li>
                Attempt to bypass rate limits, security features, or content
                filters.
              </li>
            </ul>
            <p className="mt-tight">
              We may suspend or terminate accounts that violate these rules,
              with or without notice, and we may refuse service to anyone for
              any lawful reason.
            </p>
          </Section>

          <Section title="9. Third-party services">
            <p>
              The Service relies on third-party providers including Stripe
              (payments), Supabase (database, authentication, storage), Google
              (Gemini and Veo AI models), and Vercel (hosting). Your use of the
              Service is also subject to the terms and acceptable-use policies
              of these providers. Brief outages or model errors caused by
              third-party providers are not breaches of these Terms.
            </p>
          </Section>

          <Section title="10. Disclaimer of warranties">
            <p>
              THE SERVICE AND ALL OUTPUT ARE PROVIDED &ldquo;AS IS&rdquo; AND
              &ldquo;AS AVAILABLE&rdquo; WITHOUT WARRANTIES OF ANY KIND,
              EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF
              MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
              NON-INFRINGEMENT, ACCURACY, OR UNINTERRUPTED OPERATION. WE DO NOT
              WARRANT THAT THE SERVICE WILL MEET YOUR REQUIREMENTS OR THAT
              OUTPUT WILL BE ACCURATE, FEASIBLE, OR SUITABLE FOR ANY PURPOSE.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, LANDSCAIP AND ITS
              OFFICERS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
              DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR GOODWILL,
              ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
              OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO
              THESE TERMS OR THE SERVICE WILL NOT EXCEED THE GREATER OF (A)
              THE AMOUNTS YOU PAID TO LANDSCAIP IN THE TWELVE MONTHS PRECEDING
              THE EVENT GIVING RISE TO THE CLAIM, OR (B) USD $100.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify and hold Landscaip harmless from any
              claim, loss, liability, or expense (including reasonable
              attorneys&rsquo; fees) arising out of your User Content, your
              use of Output, your breach of these Terms, or your violation of
              any law or third-party right.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You may close your account at any time from{" "}
              <Link
                href="/account"
                className="text-primary hover:underline"
              >
                Account settings
              </Link>{" "}
              or by contacting support. We may suspend or terminate your
              account if you breach these Terms or if we are required to do so
              by law. On termination, your right to use the Service ends
              immediately. Sections that by their nature should survive
              termination will survive (including payments owed, disclaimers,
              limitation of liability, and indemnification).
            </p>
          </Section>

          <Section title="14. Changes to these Terms">
            <p>
              We may update these Terms from time to time. If we make material
              changes we will update the Effective date above and, where
              reasonable, notify you by email or in-product notice before the
              change takes effect. Continued use of the Service after the
              effective date constitutes acceptance of the updated Terms.
            </p>
          </Section>

          <Section title="15. Governing law and disputes">
            <p>
              These Terms are governed by the laws of the State of Delaware,
              United States, without regard to its conflict-of-laws principles.
              You and Landscaip agree to the exclusive jurisdiction of the
              state and federal courts located in Delaware for any dispute
              arising out of or relating to these Terms, except that either
              party may seek injunctive relief in any court of competent
              jurisdiction.
            </p>
          </Section>

          <Section title="16. Text messaging (SMS)">
            <p>
              Landscapers who use the Service may send you transactional text
              messages about your service — for example, appointment and job
              reminders, quotes, and invoices (the &ldquo;Messaging
              Program&rdquo;). You consent to receive these messages by
              providing your mobile number and opting in (for example, by
              checking the consent box on a landscaper&rsquo;s request form).
              Consent to receive texts is not a condition of any purchase.
            </p>
            <p className="mt-3">
              Message frequency varies.{" "}
              <strong>Message and data rates may apply.</strong> Reply{" "}
              <strong>STOP</strong> to any message to unsubscribe at any time, or{" "}
              <strong>HELP</strong> for help. Carriers are not liable for delayed
              or undelivered messages. For support, email{" "}
              <a
                href="mailto:support@landscaip.co"
                className="text-primary hover:underline"
              >
                support@landscaip.co
              </a>
              . Mobile opt-in information is never shared with third parties or
              sold, and is not used for marketing — see our{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>

          <Section title="17. Contact">
            <p>
              Questions about these Terms? Contact us at{" "}
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

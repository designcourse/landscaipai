import Link from "next/link";

export const metadata = {
  title: "FAQ — Landscaip",
  description:
    "Answers to common questions about credits, photos, plants, and billing.",
};

const FAQS = [
  {
    q: "Is it really free to try?",
    a: "Yes. New accounts get 3 design generations on signup — no credit card required.",
  },
  {
    q: "How do credits work?",
    a: "Each AI generation, in-painting edit, or re-prompt uses about 1 credit. Cinematic videos use 8–32 credits depending on length and resolution. Credits never expire.",
  },
  {
    q: "Will the plants actually grow where I live?",
    a: "We filter recommended species against your USDA hardiness zone. You can set your ZIP code or zone in the project menu (3-dot icon → Set zone). Once set, the plant library only shows species suitable for your zone.",
  },
  {
    q: "Does my house get distorted in the render?",
    a: "The AI model is prompted to preserve structural elements — siding, windows, doors, driveway, fence line — and only modify vegetation, hardscape, and ground cover. Results may vary, so always confirm before acting on a design.",
  },
  {
    q: "Can I use renders commercially?",
    a: "Yes. You own the renderings the Service produces from your photos and may use them for personal or commercial projects (subject to the Terms of Service).",
  },
  {
    q: "Do you store my photos?",
    a: "We store your uploads and renderings in your account so you can return to them. You can delete any photo or generation at any time. See the Privacy Policy for details on retention.",
  },
  {
    q: "Can I get a refund?",
    a: "Unused credit packs can be refunded within 7 days of purchase — email support@landscaip.co. Credits already used cannot be refunded. Failed generations caused by a fault on our side are automatically refunded to your in-app balance.",
  },
  {
    q: "What AI models do you use?",
    a: "Image generation runs on Google's Gemini family (Nano Banana 2 / Pro) and optionally OpenAI gpt-image-2. Video generation uses Google Veo. We do not train any AI models on your photos or output.",
  },
  {
    q: "How do I cancel?",
    a: "Credit packs are one-time purchases — there's nothing to cancel. To delete your account, email support@landscaip.co from the address on file.",
  },
];

export default function FaqPage() {
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-3xl px-element py-section">
        <header className="mb-group">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            Frequently asked questions
          </h1>
          <p className="mt-tight text-base text-muted-foreground">
            The questions we get every day. Don&rsquo;t see yours? Email{" "}
            <a
              href="mailto:support@landscaip.co"
              className="text-primary hover:underline"
            >
              support@landscaip.co
            </a>
            .
          </p>
        </header>

        <div className="space-y-tight">
          {FAQS.map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-border bg-white p-element transition-colors hover:border-panel-border-strong"
            >
              <summary className="flex cursor-pointer list-none items-start justify-between gap-element text-base font-semibold text-foreground">
                <span>{f.q}</span>
                <svg
                  className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <p className="mt-tight text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </p>
            </details>
          ))}
        </div>

        <div className="mt-group rounded-lg border border-border bg-panel p-element text-center">
          <p className="text-sm text-muted-foreground">
            Still stuck? Read the{" "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            , or{" "}
            <Link href="/contact" className="text-primary hover:underline">
              get in touch
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  );
}

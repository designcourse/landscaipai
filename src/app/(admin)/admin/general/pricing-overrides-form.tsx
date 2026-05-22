"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditPack } from "@/lib/stripe/config";
import type {
  CreditPackOverride,
  CreditPackOverridesMap,
} from "@/lib/billing/packs";

interface Props {
  defaultPacks: CreditPack[];
  initialOverrides: CreditPackOverridesMap;
  initialHasAny: boolean;
}

interface Draft {
  packId: string;
  priceDollars: string;
  credits: string;
}

function toDraft(
  pack: CreditPack,
  override: CreditPackOverride | undefined
): Draft {
  const priceCents = override?.price_cents ?? pack.priceCents;
  const credits = override?.credits ?? pack.credits;
  return {
    packId: pack.id,
    priceDollars: (priceCents / 100).toString(),
    credits: credits.toString(),
  };
}

function diff(draft: Draft, def: CreditPack): CreditPackOverride | null {
  const priceCents = Math.round(parseFloat(draft.priceDollars) * 100);
  const credits = parseInt(draft.credits, 10);
  if (Number.isNaN(priceCents) || Number.isNaN(credits)) return null;
  const out: CreditPackOverride = {};
  if (priceCents !== def.priceCents) out.price_cents = priceCents;
  if (credits !== def.credits) out.credits = credits;
  return Object.keys(out).length > 0 ? out : null;
}

export function PricingOverridesForm({
  defaultPacks,
  initialOverrides,
  initialHasAny,
}: Props) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    defaultPacks.map((p) => toDraft(p, initialOverrides[p.id]))
  );
  const [saving, setSaving] = useState(false);
  const [hasAnyOverride, setHasAnyOverride] = useState(initialHasAny);
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);

  const dirty = useMemo(() => {
    return drafts.some((d, i) => {
      const def = defaultPacks[i];
      const orig = toDraft(def, initialOverrides[def.id]);
      return d.priceDollars !== orig.priceDollars || d.credits !== orig.credits;
    });
  }, [drafts, defaultPacks, initialOverrides]);

  function update(i: number, patch: Partial<Draft>) {
    setDrafts((prev) =>
      prev.map((d, idx) => (idx === i ? { ...d, ...patch } : d))
    );
    setFeedback(null);
  }

  async function save(payload: CreditPackOverridesMap) {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/credit-packs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback({
          kind: "error",
          message: data?.error || "Save failed.",
        });
        return;
      }
      setHasAnyOverride(Object.keys(payload).length > 0);
      setFeedback({ kind: "success", message: "Saved." });
      router.refresh();
    } catch {
      setFeedback({ kind: "error", message: "Network error." });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: CreditPackOverridesMap = {};
    for (let i = 0; i < drafts.length; i++) {
      const d = diff(drafts[i], defaultPacks[i]);
      if (d) payload[drafts[i].packId] = d;
    }
    await save(payload);
  }

  async function handleReset() {
    setDrafts(defaultPacks.map((p) => toDraft(p, undefined)));
    await save({});
  }

  return (
    <section>
      <div className="mb-element flex items-start justify-between gap-element">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Credit pack pricing
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Override price or credits per pack. Saved changes apply immediately
            to checkout and to every pricing display on the site.
          </p>
        </div>
        {hasAnyOverride && (
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Overrides active
          </span>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-white p-section"
      >
        <div className="grid grid-cols-12 gap-element border-b border-border pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Pack</div>
          <div className="col-span-3">Default</div>
          <div className="col-span-2">Price ($)</div>
          <div className="col-span-2">Credits</div>
          <div className="col-span-1 text-right">$/credit</div>
        </div>

        <div className="divide-y divide-border">
          {drafts.map((d, i) => {
            const def = defaultPacks[i];
            const priceCents = Math.round(parseFloat(d.priceDollars) * 100);
            const credits = parseInt(d.credits, 10);
            const perCredit =
              !Number.isNaN(priceCents) &&
              !Number.isNaN(credits) &&
              credits > 0
                ? priceCents / 100 / credits
                : 0;
            const overridden = diff(d, def) != null;
            const belowStripeMin =
              !Number.isNaN(priceCents) && priceCents < 50;
            return (
              <div
                key={d.packId}
                className="grid grid-cols-12 items-center gap-element py-3"
              >
                <div className="col-span-4">
                  <p className="text-sm font-semibold text-foreground">
                    {def.name}
                    {overridden && (
                      <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800">
                        Override
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {d.packId}
                  </p>
                </div>
                <div className="col-span-3 text-sm text-muted-foreground">
                  ${(def.priceCents / 100).toFixed(2)} / {def.credits} cr
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0.50"
                    inputMode="decimal"
                    value={d.priceDollars}
                    onChange={(e) =>
                      update(i, { priceDollars: e.target.value })
                    }
                    aria-label={`${def.name} price in dollars`}
                    className={`w-full rounded-md border bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary ${
                      belowStripeMin ? "border-red-400" : "border-border"
                    }`}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    value={d.credits}
                    onChange={(e) => update(i, { credits: e.target.value })}
                    aria-label={`${def.name} credit count`}
                    className="w-full rounded-md border border-border bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="col-span-1 text-right text-xs text-muted-foreground">
                  ${perCredit.toFixed(3)}
                </div>
              </div>
            );
          })}
        </div>

        {feedback && (
          <p
            className={`mt-element text-sm ${
              feedback.kind === "success"
                ? "text-primary"
                : "text-destructive"
            }`}
          >
            {feedback.message}
          </p>
        )}

        <div className="mt-element flex items-center justify-between border-t border-border pt-element">
          <p className="text-xs text-muted-foreground">
            Stripe&apos;s USD minimum is $0.50 per charge. Prices below that
            will fail at checkout.
          </p>
          <div className="flex items-center gap-tight">
            <button
              type="button"
              onClick={handleReset}
              disabled={saving || !hasAnyOverride}
              className="rounded-md border border-border bg-white px-element py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset to defaults
            </button>
            <button
              type="submit"
              disabled={saving || !dirty}
              className="rounded-md bg-primary px-element py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

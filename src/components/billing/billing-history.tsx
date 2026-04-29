"use client";

import { useEffect, useMemo, useState } from "react";
import {
  derivePurchase,
  formatAmount,
  formatPurchaseDate,
  type PurchaseRow,
} from "@/lib/billing/purchases";
import type { CreditTransaction } from "@/types";

interface Props {
  transactions: CreditTransaction[];
  defaultBillTo: string;
}

export function BillingHistory({ transactions, defaultBillTo }: Props) {
  const purchases = useMemo(
    () => transactions.map(derivePurchase),
    [transactions]
  );

  const [activeInvoice, setActiveInvoice] = useState<PurchaseRow | null>(null);

  return (
    <>
      <div className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
        <header className="flex flex-col gap-element border-b border-border-light px-group py-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Billing history
            </h2>
            <p className="mt-tight text-[13px] leading-5 text-muted-foreground">
              Your past credit pack purchases.
            </p>
          </div>
        </header>

        {purchases.length === 0 ? (
          <div className="px-group py-section text-center">
            <p className="text-sm text-muted-foreground">
              No purchases yet. When you buy credits, your invoices will show up here.
            </p>
          </div>
        ) : (
          <PurchaseTable
            purchases={purchases}
            onDownload={(p) => setActiveInvoice(p)}
          />
        )}
      </div>

      {activeInvoice && (
        <InvoiceModal
          purchase={activeInvoice}
          defaultBillTo={defaultBillTo}
          onClose={() => setActiveInvoice(null)}
        />
      )}
    </>
  );
}

function PurchaseTable({
  purchases,
  onDownload,
}: {
  purchases: PurchaseRow[];
  onDownload: (p: PurchaseRow) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-[140px_1fr_110px_120px_150px] gap-element border-b border-border-light bg-[#FAFAFA] px-group py-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <div>Date</div>
        <div>Description</div>
        <div className="text-right">Credits</div>
        <div className="text-right">Amount</div>
        <div />
      </div>

      {purchases.map((p, idx) => (
        <div
          key={p.id}
          className={`grid grid-cols-[140px_1fr_110px_120px_150px] items-center gap-element px-group py-4 ${
            idx < purchases.length - 1 ? "border-b border-border-light" : ""
          }`}
        >
          <div className="text-[13px] font-medium text-foreground">
            {formatPurchaseDate(p.createdAt)}
          </div>
          <div className="flex flex-col gap-1.5">
            <Pill />
            <p className="text-[13px] leading-5">
              <span className="font-semibold text-foreground">
                {p.packName}
              </span>{" "}
              <span className="text-muted-foreground">
                — one-time credits · #{p.invoiceNumber}
              </span>
            </p>
          </div>
          <div className="text-right text-[13px] font-semibold text-success">
            +{p.credits}
          </div>
          <div className="text-right text-sm font-semibold text-foreground">
            {formatAmount(p.amountCents)}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onDownload(p)}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-sm px-2 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-primary/5"
            >
              <DownloadIcon />
              Download invoice
            </button>
          </div>
        </div>
      ))}
    </>
  );
}

function Pill() {
  return (
    <span className="inline-flex w-fit items-center rounded-full bg-border-light px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
      One-time
    </span>
  );
}

function InvoiceModal({
  purchase,
  defaultBillTo,
  onClose,
}: {
  purchase: PurchaseRow;
  defaultBillTo: string;
  onClose: () => void;
}) {
  const [billTo, setBillTo] = useState(defaultBillTo);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Esc to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !generating) onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, generating]);

  async function handleGenerate() {
    setError(null);
    setGenerating(true);

    try {
      const res = await fetch(`/api/billing/invoice/${purchase.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billTo }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate invoice");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${purchase.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate invoice");
      setGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-element"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !generating && onClose()}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[580px] rounded-md bg-white p-group shadow-lg">
        <button
          type="button"
          onClick={() => !generating && onClose()}
          disabled={generating}
          className="absolute right-4 top-4 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Close"
        >
          <CloseIcon />
        </button>

        <header className="pr-8">
          <h3
            id="invoice-modal-title"
            className="text-lg font-semibold text-foreground"
          >
            Generate invoice
          </h3>
          <p className="mt-tight text-[13px] leading-5 text-muted-foreground">
            Review the billing details below. Edits here only affect this
            invoice — they don&rsquo;t change your account settings.
          </p>
        </header>

        <div className="mt-element grid grid-cols-2 gap-element rounded-sm bg-muted px-element py-3">
          <MetaCell label="Invoice" value={`#${purchase.invoiceNumber}`} />
          <MetaCell
            label="Date"
            value={formatPurchaseDate(purchase.createdAt)}
          />
          <MetaCell label="Amount" value={formatAmount(purchase.amountCents)} />
          <MetaCell label="Item" value={`${purchase.packName} — ${purchase.credits} credits`} />
        </div>

        <div className="mt-element">
          <div className="flex items-center justify-between">
            <label
              htmlFor="bill-to"
              className="text-[13px] font-medium text-foreground"
            >
              Bill to
            </label>
            <span className="text-xs text-muted-foreground">
              Pre-filled from your account
            </span>
          </div>
          <textarea
            id="bill-to"
            value={billTo}
            onChange={(e) => setBillTo(e.target.value)}
            rows={6}
            className="mt-tight block w-full rounded-sm border border-border bg-white px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Enter the billing address that should appear on the invoice."
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Edit anything above. The original details are saved on your account
            and won&rsquo;t be overwritten.
          </p>
        </div>

        {error && (
          <p className="mt-element text-sm text-destructive">{error}</p>
        )}

        <div className="mt-element flex justify-end gap-tight">
          <button
            type="button"
            onClick={onClose}
            disabled={generating}
            className="cursor-pointer rounded-sm border border-border bg-white px-[18px] py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="cursor-pointer rounded-sm bg-primary px-[18px] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate invoice (PDF)"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-foreground">{value}</p>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

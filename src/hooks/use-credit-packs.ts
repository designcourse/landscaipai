"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKS, type CreditPack } from "@/lib/stripe/config";

// Last-known-good packs let a freshly-mounted consumer paint with the latest
// resolved prices synchronously (avoids a 1-frame flash of defaults). Every
// mount still re-fetches so admin override changes propagate without a hard
// page reload.
let lastKnownPacks: readonly CreditPack[] | null = null;

export function useCreditPacks(): {
  packs: readonly CreditPack[];
  loading: boolean;
} {
  const [packs, setPacks] = useState<readonly CreditPack[]>(
    lastKnownPacks ?? CREDIT_PACKS
  );
  const [loading, setLoading] = useState(lastKnownPacks == null);

  useEffect(() => {
    let active = true;
    fetch("/api/credit-packs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => {
        if (!active) return;
        if (Array.isArray(d?.packs)) {
          lastKnownPacks = d.packs as CreditPack[];
          setPacks(d.packs as CreditPack[]);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { packs, loading };
}

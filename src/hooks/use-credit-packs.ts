"use client";

import { useEffect, useState } from "react";
import { CREDIT_PACKS, type CreditPack } from "@/lib/stripe/config";

// Module-level cache so the four pricing surfaces (landing pricing, /pricing
// page, purchase modal, slider) share a single fetch per page load.
let cachedPacks: readonly CreditPack[] | null = null;
let inFlight: Promise<readonly CreditPack[]> | null = null;

async function loadPacks(): Promise<readonly CreditPack[]> {
  if (cachedPacks) return cachedPacks;
  if (inFlight) return inFlight;
  inFlight = fetch("/api/credit-packs")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
    .then((d) => {
      const packs = Array.isArray(d?.packs) ? (d.packs as CreditPack[]) : CREDIT_PACKS;
      cachedPacks = packs;
      return packs;
    })
    .catch(() => CREDIT_PACKS)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useCreditPacks(): {
  packs: readonly CreditPack[];
  loading: boolean;
} {
  const [packs, setPacks] = useState<readonly CreditPack[]>(
    cachedPacks ?? CREDIT_PACKS
  );
  const [loading, setLoading] = useState(cachedPacks == null);

  useEffect(() => {
    let active = true;
    loadPacks().then((p) => {
      if (!active) return;
      // Setting equal-by-reference state bails out in the reconciler, so this
      // is safe even when another consumer has already filled the cache.
      setPacks(p);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { packs, loading };
}

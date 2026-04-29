"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { PurchaseCreditsModal } from "./purchase-credits-modal";

interface OpenOptions {
  title?: string;
  subtitle?: string;
  successUrl?: string;
  cancelUrl?: string;
}

interface PurchaseCreditsContextValue {
  isOpen: boolean;
  open: (opts?: OpenOptions) => void;
  close: () => void;
}

const PurchaseCreditsContext =
  createContext<PurchaseCreditsContextValue | null>(null);

export function PurchaseCreditsProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<OpenOptions>({});

  const open = useCallback((next?: OpenOptions) => {
    setOpts(next ?? {});
    setIsOpen(true);
  }, []);

  const close = useCallback(() => setIsOpen(false), []);

  return (
    <PurchaseCreditsContext.Provider value={{ isOpen, open, close }}>
      {children}
      <PurchaseCreditsModal
        open={isOpen}
        onClose={close}
        title={opts.title}
        subtitle={opts.subtitle}
        successUrl={opts.successUrl}
        cancelUrl={opts.cancelUrl}
      />
    </PurchaseCreditsContext.Provider>
  );
}

export function usePurchaseCredits() {
  const ctx = useContext(PurchaseCreditsContext);
  if (!ctx) {
    throw new Error(
      "usePurchaseCredits must be used inside PurchaseCreditsProvider"
    );
  }
  return ctx;
}

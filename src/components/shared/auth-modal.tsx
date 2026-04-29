"use client";

import { useEffect } from "react";
import { AuthForm } from "./auth-form";
import { useAuthModal } from "./auth-modal-context";

export function AuthModal() {
  const { isOpen, mode, closeModal, setMode } = useAuthModal();

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, closeModal]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-element"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={closeModal}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-lg bg-background p-section shadow-lg">
        <button
          type="button"
          onClick={closeModal}
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Close"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <AuthForm
          key={mode}
          mode={mode}
          variant="modal"
          onSwitchMode={() => setMode(mode === "login" ? "signup" : "login")}
          onSuccess={closeModal}
        />
      </div>
    </div>
  );
}

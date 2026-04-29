"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type AuthMode = "login" | "signup";

interface AuthModalContextValue {
  isOpen: boolean;
  mode: AuthMode;
  openModal: (mode: AuthMode) => void;
  closeModal: () => void;
  setMode: (mode: AuthMode) => void;
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<AuthMode>("signup");

  const openModal = useCallback((newMode: AuthMode) => {
    setModeState(newMode);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setMode = useCallback((newMode: AuthMode) => {
    setModeState(newMode);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  return (
    <AuthModalContext.Provider
      value={{ isOpen, mode, openModal, closeModal, setMode }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider");
  }
  return ctx;
}

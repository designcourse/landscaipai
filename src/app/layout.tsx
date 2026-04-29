import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/components/shared/site-chrome.css";
import { AuthModalProvider } from "@/components/shared/auth-modal-context";
import { AuthModal } from "@/components/shared/auth-modal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Landscaip - AI Landscaping Visualization",
    template: "%s | Landscaip",
  },
  description:
    "Upload a photo of your house, get professional landscaping designs in seconds.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0F8000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthModalProvider>
          {children}
          <AuthModal />
        </AuthModalProvider>
      </body>
    </html>
  );
}

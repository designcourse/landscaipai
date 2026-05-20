import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@/components/shared/site-chrome.css";
import { AuthModalProvider } from "@/components/shared/auth-modal-context";
import { AuthModal } from "@/components/shared/auth-modal";
import { PurchaseCreditsProvider } from "@/components/billing/purchase-credits-modal-context";
import { ServiceWorkerRegister } from "@/components/shared/service-worker-register";
import { PwaSplash } from "@/components/shared/pwa-splash";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://landscaip.co"),
  title: {
    default: "Landscaip - AI Landscaping Visualization",
    template: "%s | Landscaip",
  },
  description:
    "Upload a photo of your house, get professional landscaping designs in seconds.",
  manifest: "/manifest.json",
  applicationName: "Landscaip",
  appleWebApp: {
    capable: true,
    title: "Landscaip",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#0F8000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
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
          <PurchaseCreditsProvider>
            {children}
            <AuthModal />
          </PurchaseCreditsProvider>
        </AuthModalProvider>
        <ServiceWorkerRegister />
        <PwaSplash />
      </body>
    </html>
  );
}

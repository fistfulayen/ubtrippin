import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";

export const metadata: Metadata = {
  title: "UBTRIPPIN - Turn Booking Emails into Beautiful Itineraries",
  description: "Forward your travel confirmation emails and get organized trip timelines with downloadable PDFs.",
  manifest: "/manifest.json",
  icons: {
    icon: '/favicon.ico',
    apple: '/icons/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "UBTRIPPIN",
  },
  openGraph: {
    title: "UBTRIPPIN",
    description: "Turn Booking Emails into Beautiful Itineraries",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1e293b",
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
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

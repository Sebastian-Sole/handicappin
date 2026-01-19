import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BillingSync } from "@/components/billing-sync";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
} from "@/components/seo/json-ld";
import { createServerComponentClient } from "@/utils/supabase/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://handicappin.com"),
  title: {
    default:
      "Handicappin' - Golf Handicap Tracker & Calculator | USGA Compliant",
    template: "%s | Handicappin'",
  },
  description:
    "Track your golf handicap with USGA-compliant calculations. Log rounds, calculate your handicap index automatically, and understand every calculation. Free golf handicap tracking app.",
  keywords: [
    "golf handicap",
    "handicap calculator",
    "golf handicap tracker",
    "USGA handicap",
    "golf app",
    "handicap index",
    "golf round tracker",
    "score differential",
    "course handicap",
    "golf statistics",
    "handicappin",
  ],
  authors: [{ name: "Handicappin'" }],
  creator: "Handicappin'",
  publisher: "Handicappin'",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://handicappin.com",
    siteName: "Handicappin'",
    title: "Handicappin' - Golf Handicap Tracker & Calculator",
    description:
      "Track your golf handicap with USGA-compliant calculations. Log rounds, calculate your handicap index automatically, and understand every calculation.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handicappin' - Golf Handicap Tracker & Calculator",
    description:
      "Track your golf handicap with USGA-compliant calculations. Free golf handicap tracking app.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    // Add Google Search Console verification code here after setup
    // google: "your-google-verification-code",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch user once at layout level to avoid duplicate auth calls
  const supabase = await createServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <SoftwareApplicationJsonLd />
      </head>
      <body className={inter.className}>
        <div className="flex flex-col min-h-screen">
          <TRPCReactProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              {/* BillingSync handles its own auth detection */}
              <BillingSync />

              <Navbar user={user} />
              <section className="pt-16 grow bg-background flex flex-col">{children}</section>
              <Footer />
              <Toaster />
            </ThemeProvider>
          </TRPCReactProvider>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

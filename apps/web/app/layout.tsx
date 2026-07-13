import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { ChromeGate, MainShell } from "@/components/layout/chrome-gate";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BillingSync } from "@/components/billing-sync";
import { AnalyticsIdentify } from "@/components/analytics-identify";
import {
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  WebSiteJsonLd,
} from "@/components/seo/json-ld";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://handicappin.com"),
  title: {
    default:
      "Handicappin' - Golf Handicap Tracker & Calculator | Transparent WHS-Method Math",
    template: "%s | Handicappin'",
  },
  description:
    "Track your golf handicap with calculations that follow the World Handicap System (WHS) method — every step shown. Log rounds and calculate your handicap index automatically. Unofficial: not an official handicap service. Free golf handicap tracking app.",
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
  alternates: {
    canonical: "https://handicappin.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://handicappin.com",
    siteName: "Handicappin'",
    title: "Handicappin' - Golf Handicap Tracker & Calculator",
    description:
      "Track your golf handicap with calculations that follow the World Handicap System (WHS) method — every step shown. Unofficial: not an official handicap service.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Handicappin' - Golf Handicap Tracker & Calculator",
    description:
      "Track your golf handicap with calculations that follow the WHS method — every step shown. Unofficial: not an official handicap service. Free golf handicap tracking app.",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        <SoftwareApplicationJsonLd />
      </head>
      <body className={`${inter.variable} ${inter.className}`}>
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
              {/* PostHog identify — same one-shot auth detection pattern */}
              <AnalyticsIdentify />

              <ChromeGate>
                <Navbar />
              </ChromeGate>
              <MainShell>{children}</MainShell>
              <ChromeGate>
                <Footer />
              </ChromeGate>
            </ThemeProvider>
          </TRPCReactProvider>
        </div>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}

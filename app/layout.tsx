import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/theme-provider";
import { Navbar } from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Analytics } from "@vercel/analytics/next";
import { BillingSync } from "@/components/billing-sync";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Handicappin'",
  description: "Golf made easy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
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

              <Navbar />
              <section className="pt-16 grow bg-background">{children}</section>
              <Footer />
              <Toaster />
            </ThemeProvider>
          </TRPCReactProvider>
        </div>
        <Analytics />
      </body>
    </html>
  );
}

import { Badge } from "@/components/ui/badge";
import { P } from "@/components/ui/typography";
import { TermsContent } from "@/components/legal/terms-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Handicappin'",
  description:
    "Terms of Service for Handicappin' golf handicap tracking application. Read our terms regarding subscriptions, refunds, lifetime plans, and service usage.",
  alternates: {
    canonical: "https://handicappin.com/terms-of-service",
  },
  openGraph: {
    title: "Terms of Service - Handicappin'",
    description:
      "Terms of Service for Handicappin' golf handicap tracking application.",
    url: "https://handicappin.com/terms-of-service",
  },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-primary/5 to-primary/20 dark:from-primary/5 dark:to-primary/35">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <Badge>Legal</Badge>
            <h1 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Terms of Service
            </h1>
            <P className="text-foreground/80 md:text-xl/relaxed">
              Please read these terms carefully before using Handicappin&apos;.
            </P>
          </div>
        </div>
      </section>

      {/* Terms Content */}
      <section className="w-full py-12 md:py-24">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="mx-auto max-w-3xl">
            <TermsContent />
          </div>
        </div>
      </section>
    </div>
  );
}

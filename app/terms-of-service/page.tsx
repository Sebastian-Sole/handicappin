import { Badge } from "@/components/ui/badge";
import { H1, P } from "@/components/ui/typography";
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
      <section className="w-full py-2xl md:py-4xl lg:py-5xl hero-gradient">
        <div className="sm:container px-md md:px-lg mx-auto">
          <div className="mx-auto max-w-3xl space-y-md text-center">
            <Badge>Legal</Badge>
            <H1 className="lg:leading-tighter sm:text-4xl md:text-5xl">
              Terms of Service
            </H1>
            <P className="text-foreground/80 md:text-xl/relaxed">
              Please read these terms carefully before using Handicappin&apos;.
            </P>
          </div>
        </div>
      </section>

      {/* Terms Content */}
      <section className="w-full py-2xl md:py-4xl">
        <div className="sm:container px-md md:px-lg mx-auto">
          <div className="mx-auto max-w-3xl">
            <TermsContent />
          </div>
        </div>
      </section>
    </div>
  );
}

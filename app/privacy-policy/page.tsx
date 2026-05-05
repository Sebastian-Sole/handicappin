import { Badge } from "@/components/ui/badge";
import { H1, P } from "@/components/ui/typography";
import { PrivacyContent } from "@/components/legal/privacy-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Handicappin'",
  description:
    "Privacy Policy for Handicappin' golf handicap tracking application. Learn how we collect, use, and protect your personal data.",
  alternates: {
    canonical: "https://handicappin.com/privacy-policy",
  },
  openGraph: {
    title: "Privacy Policy - Handicappin'",
    description:
      "Privacy Policy for Handicappin' golf handicap tracking application.",
    url: "https://handicappin.com/privacy-policy",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="w-full py-2xl md:py-4xl lg:py-5xl hero-gradient">
        <div className="sm:container px-md md:px-lg mx-auto">
          <div className="mx-auto max-w-3xl space-y-md text-center">
            <Badge>Legal</Badge>
            <H1 className="lg:leading-tighter sm:text-4xl md:text-5xl">
              Privacy Policy
            </H1>
            <P className="text-foreground/80 md:text-xl/relaxed">
              Your privacy matters to us. This policy explains how we collect,
              use, and protect your personal data.
            </P>
          </div>
        </div>
      </section>

      {/* Privacy Content */}
      <section className="w-full py-2xl md:py-4xl">
        <div className="sm:container px-md md:px-lg mx-auto">
          <div className="mx-auto max-w-3xl">
            <PrivacyContent />
          </div>
        </div>
      </section>
    </div>
  );
}

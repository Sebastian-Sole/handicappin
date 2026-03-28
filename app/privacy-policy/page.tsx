import { Badge } from "@/components/ui/badge";
import { P } from "@/components/ui/typography";
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
      <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-br from-primary/5 to-primary/20 dark:from-primary/5 dark:to-primary/35">
        <div className="sm:container px-4 md:px-6 mx-auto">
          <div className="mx-auto max-w-3xl space-y-4 text-center">
            <Badge>Legal</Badge>
            <h1 className="lg:leading-tighter text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
              Privacy Policy
            </h1>
            <P className="text-foreground/80 md:text-xl/relaxed">
              Your privacy matters to us. This policy explains how we collect,
              use, and protect your personal data.
            </P>
          </div>
        </div>
      </section>

      {/* Privacy Content */}
      <section className="w-full py-12 md:py-24">
        <div className="sm:container px-4 md:px-6 mx-auto">
          <div className="mx-auto max-w-3xl">
            <PrivacyContent />
          </div>
        </div>
      </section>
    </div>
  );
}

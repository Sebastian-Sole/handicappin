// app/contact/page.tsx
import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { H1, H2, H3, P } from "@/components/ui/typography";
import { ContactForm } from "@/components/contact/contact-form";
import { ContactPageJsonLd, FAQJsonLd } from "@/components/seo/json-ld";
import { Mail, Clock, MessageSquare, HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Contact Us - Get Help with Handicappin'",
  description:
    "Have questions about your golf handicap? Need help with Handicappin'? Contact our support team. We typically respond within 24 hours.",
  keywords: [
    "contact handicappin",
    "golf handicap support",
    "handicap tracking help",
    "golf app support",
  ],
  alternates: {
    canonical: "https://handicappin.com/contact",
  },
  openGraph: {
    title: "Contact Us - Handicappin' Support",
    description:
      "Get in touch with the Handicappin' team for questions about golf handicap tracking, feature requests, or support.",
    url: "https://handicappin.com/contact",
  },
};

const faqs = [
  {
    question: "How is my handicap index calculated?",
    answer:
      "Your handicap index is calculated using the USGA World Handicap System. It uses the best 8 of your last 20 score differentials, multiplied by 0.96. Each score differential is calculated as (Adjusted Gross Score - Course Rating) x 113 / Slope Rating.",
  },
  {
    question: "Is Handicappin' USGA compliant?",
    answer:
      "Yes! Handicappin' follows the official USGA World Handicap System rules for all calculations, including exceptional score reduction (ESR), soft caps, and hard caps. Our calculations are transparent and match official USGA methodology.",
  },
  {
    question: "How do I add a course that's not in the database?",
    answer:
      "If you can't find your course, you can submit a course request through the app. We'll verify the course rating and slope information and add it to our database, usually within 24-48 hours.",
  },
  {
    question: "Can I import my rounds from another handicap service?",
    answer:
      "Currently, manual entry is required for all rounds. We're working on import functionality from popular services. Contact us if you have a specific import need and we'll try to help.",
  },
  {
    question: "What's included in each subscription plan?",
    answer:
      "Free accounts can track up to 25 rounds. Premium ($19/year) and Unlimited ($29/year) plans offer unlimited round tracking, advanced analytics, and priority support. Lifetime access is available for a one-time payment of $149.",
  },
  {
    question: "How do I cancel my subscription?",
    answer:
      "You can manage your subscription from the Billing page in your account settings. Click 'Manage Subscription' to access the Stripe Customer Portal where you can cancel, upgrade, or update payment methods.",
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <ContactPageJsonLd />
      <FAQJsonLd faqs={faqs} />

      {/* Hero Section */}
      <section className="w-full py-2xl md:py-4xl lg:py-5xl bg-gradient-to-br from-primary/5 to-primary/20 dark:from-primary/5 dark:to-primary/35">
        <div className="mx-auto max-w-3xl px-md md:px-lg text-center">
          <Badge className="mb-md">Contact Us</Badge>
          <H1 className="lg:leading-tighter sm:text-4xl md:text-5xl xl:text-[3.4rem] 2xl:text-[3.75rem] mb-md">
            We&apos;re Here to Help
          </H1>
          <P className="text-foreground/80 md:text-xl/relaxed max-w-2xl mx-auto">
            Have questions about your handicap, need help with the app, or
            want to request a feature? We&apos;d love to hear from you.
          </P>
        </div>
      </section>

      {/* Contact Form Section */}
      <section id="contact-form" className="w-full py-2xl md:py-4xl">
        <div className="mx-auto max-w-5xl px-md md:px-lg">
          <div className="grid gap-2xl lg:grid-cols-2">
            {/* Form */}
            <div className="min-w-0">
              <div className="mb-lg">
                <H2 className="mb-sm">
                  Send us a Message
                </H2>
                <P className="text-muted-foreground">
                  Fill out the form below and we&apos;ll get back to you as soon
                  as possible.
                </P>
              </div>
              <ContactForm />
            </div>

            {/* Contact Info */}
            <div className="space-y-lg min-w-0">
              <div>
                <H2 className="mb-lg">
                  Other Ways to Reach Us
                </H2>
              </div>

              {/* Email Card */}
              <div className="surface p-md sm:p-lg">
                <div className="flex items-start gap-sm sm:gap-md">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <H3 className="mb-xs">Email Us</H3>
                    <P className="text-muted-foreground mb-sm">
                      For direct inquiries or detailed questions
                    </P>
                    <a
                      href="mailto:sebastiansole@handicappin.com"
                      className="text-primary hover:underline font-medium break-all"
                    >
                      sebastiansole@handicappin.com
                    </a>
                  </div>
                </div>
              </div>

              {/* Response Time Card */}
              <div className="surface p-md sm:p-lg">
                <div className="flex items-start gap-sm sm:gap-md">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <Clock className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <H3 className="mb-xs">Response Time</H3>
                    <P className="text-muted-foreground">
                      We typically respond within{" "}
                      <span className="font-semibold text-foreground">
                        24 hours
                      </span>{" "}
                      during business days. Urgent inquiries are prioritized.
                    </P>
                  </div>
                </div>
              </div>

              {/* Feature Requests Card */}
              <div className="surface p-md sm:p-lg">
                <div className="flex items-start gap-sm sm:gap-md">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <H3 className="mb-xs">
                      Feature Requests
                    </H3>
                    <P className="text-muted-foreground">
                      Have an idea to make Handicappin&apos; better? We love
                      hearing from our users and prioritize features based on
                      community feedback.
                    </P>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="w-full py-2xl md:py-4xl bg-muted/50">
        <div className="mx-auto max-w-4xl px-md md:px-lg">
          <div className="text-center mb-2xl">
            <Badge className="mb-md">FAQ</Badge>
            <H2 className="sm:text-4xl mb-md">
              Frequently Asked Questions
            </H2>
            <P className="text-muted-foreground md:text-lg">
              Find quick answers to common questions about Handicappin&apos;
            </P>
          </div>

          <div className="grid gap-lg md:grid-cols-2">
            {faqs.map((faq, faqIndex) => (
              <div
                key={faqIndex}
                className="surface p-md sm:p-lg h-fit"
              >
                <div className="flex items-start gap-sm mb-sm">
                  <HelpCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <H3 className="font-semibold text-foreground">
                    {faq.question}
                  </H3>
                </div>
                <P className="text-muted-foreground text-sm pl-xl">
                  {faq.answer}
                </P>
              </div>
            ))}
          </div>

          <div className="mt-2xl text-center">
            <P className="text-muted-foreground">
              Still have questions?{" "}
              <a
                href="#contact-form"
                className="text-primary hover:underline font-medium"
              >
                Send us a message
              </a>{" "}
              above and we&apos;ll be happy to help.
            </P>
          </div>
        </div>
      </section>
    </div>
  );
}

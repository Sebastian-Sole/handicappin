// app/contact/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Handicappin' support team for questions about your golf handicap tracking.",
};

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-16">
      <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
      <p className="text-lg mb-8">
        Have questions about Handicappin'? We're here to help.
      </p>
      <div className="max-w-2xl">
        <p className="mb-4">
          Email us at:{" "}
          <a
            href="mailto:support@handicappin.com"
            className="text-primary hover:underline"
          >
            sebastiansole@handicappin.com
          </a>
        </p>
        {/* Add contact form or additional contact methods as needed */}
      </div>
    </div>
  );
}

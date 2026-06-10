export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Handicappin'",
    url: "https://handicappin.com",
    logo: "https://handicappin.com/images/logo.png",
    description:
      "Golf handicap tracking app with USGA-compliant calculations. Track rounds, calculate handicap index, and understand your golf statistics.",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Handicappin'",
    url: "https://handicappin.com",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://handicappin.com/?q={search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Handicappin'",
    url: "https://handicappin.com",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "AggregateOffer",
      lowPrice: "0",
      highPrice: "149",
      priceCurrency: "USD",
      offerCount: 4,
    },
    description:
      "USGA-compliant golf handicap tracking application. Log rounds, calculate handicap index automatically, and get detailed insights into your golf game.",
    featureList: [
      "USGA-compliant handicap calculation",
      "Automatic handicap index updates",
      "Detailed round tracking",
      "Course handicap calculator",
      "Score differential calculation",
      "Historical handicap tracking",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

interface FAQ {
  question: string;
  answer: string;
}

export function FAQJsonLd({ faqs }: { faqs: FAQ[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function ContactPageJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Handicappin'",
    description:
      "Get in touch with the Handicappin' team for questions about golf handicap tracking, feature requests, or support.",
    url: "https://handicappin.com/contact",
    mainEntity: {
      "@type": "Organization",
      name: "Handicappin'",
      email: "sebastiansole@handicappin.com",
      url: "https://handicappin.com",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

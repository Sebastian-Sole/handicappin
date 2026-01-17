export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Handicappin'",
    url: "https://handicappin.com",
    logo: "https://handicappin.com/logo.png",
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

export function SoftwareApplicationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Handicappin'",
    applicationCategory: "SportsApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free tier with 25 rounds",
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

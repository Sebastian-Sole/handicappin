import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

interface SubscriptionDowngradedEmailProps {
  oldPlan: string;
  newPlan: string;
  effectiveDate: Date;
  billingUrl: string;
  supportEmail: string;
}

export default function SubscriptionDowngradedEmail({
  oldPlan = "Unlimited",
  newPlan = "Premium",
  effectiveDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  billingUrl = "https://handicappin.com/billing",
  supportEmail = "sebastiansole@handicappin.com",
}: SubscriptionDowngradedEmailProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(effectiveDate);

  const capitalizedOldPlan = oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1);
  const capitalizedNewPlan = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);

  return (
    <Html>
      <Head />
      <Preview>
        Your Handicappin' plan will change to {capitalizedNewPlan} on{" "}
        {formattedDate}
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Plan Change Scheduled
              </Heading>
              <Text className="text-gray-600 mb-6">
                Your subscription will be updated at the end of your current
                billing period
              </Text>

              {/* Plan Change Box */}
              <Section className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-2">Plan Change</Text>
                <Text className="text-xl font-bold text-gray-900 mb-1">
                  {capitalizedOldPlan} → {capitalizedNewPlan}
                </Text>
                <Text className="text-sm text-orange-700">
                  Effective {formattedDate}
                </Text>
              </Section>

              {/* What This Means */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  What this means
                </Heading>
                <Text className="text-gray-600 mb-3">
                  You'll continue to enjoy {capitalizedOldPlan} features until{" "}
                  {formattedDate}. After that date, your plan will change to{" "}
                  {capitalizedNewPlan}.
                </Text>
                <Text className="text-gray-600 mb-0">
                  • No immediate changes to your access
                  <br />• Keep using all {capitalizedOldPlan} features until{" "}
                  {formattedDate}
                  <br />• Your next charge will be at the {
                    capitalizedNewPlan
                  }{" "}
                  rate
                  <br />• You can upgrade again anytime
                </Text>
              </Section>

              {/* Action Buttons */}
              <Section className="mb-6">
                <Button
                  href={billingUrl}
                  className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg inline-block mb-3"
                >
                  Change Your Mind? Upgrade Again
                </Button>
                <br />
                <Link
                  href={billingUrl}
                  className="text-blue-600 text-sm underline"
                >
                  View billing details
                </Link>
              </Section>

              {/* Support Section */}
              <Section className="border-t border-gray-200 pt-6">
                <Text className="text-sm text-gray-600 mb-2">
                  <strong>Questions?</strong>
                </Text>
                <Text className="text-sm text-gray-600">
                  If you have any questions about your plan change, contact us
                  at{" "}
                  <Link
                    href={`mailto:${supportEmail}`}
                    className="text-blue-600 underline"
                  >
                    {supportEmail}
                  </Link>
                </Text>
              </Section>

              {/* Footer */}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center mb-2">
                  This is a transactional email about your Handicappin' account.
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  © 2025 Sole Innovations. All rights reserved.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

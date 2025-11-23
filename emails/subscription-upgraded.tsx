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

interface SubscriptionUpgradedEmailProps {
  oldPlan: string;
  newPlan: string;
  proratedCharge: number;
  currency: string;
  billingUrl: string;
  supportEmail: string;
}

export default function SubscriptionUpgradedEmail({
  oldPlan = "Premium",
  newPlan = "Unlimited",
  proratedCharge = 500,
  currency = "usd",
  billingUrl = "https://handicappin.com/billing",
  supportEmail = "sebastiansole@handicappin.com",
}: SubscriptionUpgradedEmailProps) {
  const formattedCharge = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(proratedCharge / 100);

  const capitalizedOldPlan = oldPlan.charAt(0).toUpperCase() + oldPlan.slice(1);
  const capitalizedNewPlan = newPlan.charAt(0).toUpperCase() + newPlan.slice(1);

  return (
    <Html>
      <Head />
      <Preview>
        Your Handicappin' plan has been upgraded to {capitalizedNewPlan}!
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Plan Upgraded! 🎉
              </Heading>
              <Text className="text-gray-600 mb-6">
                Your subscription has been successfully upgraded
              </Text>

              {/* Plan Change Box */}
              <Section className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-2">Plan Change</Text>
                <Text className="text-xl font-bold text-gray-900 mb-1">
                  {capitalizedOldPlan} → {capitalizedNewPlan}
                </Text>
                <Text className="text-sm text-green-700">
                  ✓ Changes are effective immediately
                </Text>
              </Section>

              {/* Prorated Charge */}
              {proratedCharge > 0 && (
                <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <Text className="text-sm text-gray-600 mb-1">
                    Prorated Charge
                  </Text>
                  <Text className="text-xl font-bold text-gray-900 mb-2">
                    {formattedCharge}
                  </Text>
                  <Text className="text-sm text-blue-700">
                    This amount covers the remaining time in your billing period
                    at the new rate
                  </Text>
                </Section>
              )}

              {/* What's New */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  What's included with {capitalizedNewPlan}?
                </Heading>
                <Text className="text-gray-600 mb-0">
                  {newPlan === "unlimited" && (
                    <>
                      • Unlimited score tracking
                      <br />
                      • Unlimited handicap calculations
                      <br />
                      • Advanced analytics and insights
                      <br />• Priority support
                    </>
                  )}
                  {newPlan === "premium" && (
                    <>
                      • Track up to 100 scores per year
                      <br />
                      • Automatic handicap calculations
                      <br />
                      • Performance tracking
                      <br />• Email support
                    </>
                  )}
                </Text>
              </Section>

              {/* Action Button */}
              <Section className="mb-6">
                <Button
                  href={billingUrl}
                  className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg inline-block"
                >
                  View Billing Details
                </Button>
              </Section>

              {/* Support Section */}
              <Section className="border-t border-gray-200 pt-6">
                <Text className="text-sm text-gray-600 mb-2">
                  <strong>Questions?</strong>
                </Text>
                <Text className="text-sm text-gray-600">
                  If you have any questions about your upgrade, contact us at{" "}
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

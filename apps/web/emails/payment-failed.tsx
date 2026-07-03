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

interface PaymentFailedEmailProps {
  name?: string | null;
  plan: string | null;
  billingUrl: string;
  isFinalAttempt: boolean;
  supportEmail: string;
}

export default function PaymentFailedEmail({
  name = null,
  plan = "Premium",
  billingUrl = "https://handicappin.com/billing",
  isFinalAttempt = false,
  supportEmail = "sebastiansole@handicappin.com",
}: PaymentFailedEmailProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const capitalizedPlan = plan
    ? plan.charAt(0).toUpperCase() + plan.slice(1)
    : "subscription";

  return (
    <Html>
      <Head />
      <Preview>
        {isFinalAttempt
          ? "Final notice: your Handicappin' payment failed"
          : "We couldn't process your Handicappin' payment"}
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Payment Failed
              </Heading>
              <Text className="text-gray-600 mb-6">
                {greeting} we were unable to process the payment for your{" "}
                {capitalizedPlan} subscription.
              </Text>

              {/* Status Box */}
              <Section
                className={
                  isFinalAttempt
                    ? "bg-red-50 border border-red-200 rounded-lg p-4 mb-6"
                    : "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6"
                }
              >
                <Text className="text-sm text-gray-600 mb-2">Plan</Text>
                <Text className="text-xl font-bold text-gray-900 mb-1">
                  {capitalizedPlan}
                </Text>
                <Text
                  className={
                    isFinalAttempt
                      ? "text-sm text-red-700"
                      : "text-sm text-yellow-700"
                  }
                >
                  {isFinalAttempt
                    ? "This was our final retry attempt."
                    : "We'll automatically retry the charge."}
                </Text>
              </Section>

              {/* What Happens Next */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  What happens next?
                </Heading>
                {isFinalAttempt ? (
                  <Text className="text-gray-600 mb-0">
                    We've exhausted our automatic retries. If your payment
                    method isn't updated, your subscription will be cancelled
                    and your account will revert to the Free plan.
                  </Text>
                ) : (
                  <Text className="text-gray-600 mb-0">
                    Stripe will automatically retry the charge over the next
                    few days (Smart Retries). To avoid any interruption, you
                    can update your payment method now.
                  </Text>
                )}
              </Section>

              {/* Action Button */}
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Update your payment method
                </Text>
                <Text className="text-sm text-gray-600 mb-3">
                  Keep your subscription active by updating your billing
                  details.
                </Text>
                <Button
                  href={billingUrl}
                  className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg inline-block text-sm"
                >
                  Update Payment Method
                </Button>
              </Section>

              {/* Support Section */}
              <Section className="border-t border-gray-200 pt-6">
                <Text className="text-sm text-gray-600">
                  If you have any questions or need assistance, we're here to
                  help at{" "}
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
                  This is a transactional email about your Handicappin'
                  account.
                </Text>
                <Text className="text-xs text-gray-500 text-center">
                  © {new Date().getFullYear()} Sole Innovations. All rights
                  reserved.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

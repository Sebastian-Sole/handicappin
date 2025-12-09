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

interface SubscriptionCancelledEmailProps {
  plan: string;
  endDate: Date;
  billingUrl: string;
  supportEmail: string;
}

export default function SubscriptionCancelledEmail({
  plan = "Premium",
  endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  billingUrl = "https://handicappin.com/billing",
  supportEmail = "sebastiansole@handicappin.com",
}: SubscriptionCancelledEmailProps) {
  const formattedDate = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
  }).format(endDate);

  const capitalizedPlan = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <Html>
      <Head />
      <Preview>
        Your Handicappin' subscription will end on {formattedDate}
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Subscription Cancelled
              </Heading>
              <Text className="text-gray-600 mb-6">
                We're sorry to see you go. Your subscription has been cancelled.
              </Text>

              {/* Cancellation Info Box */}
              <Section className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-2">Plan Ending</Text>
                <Text className="text-xl font-bold text-gray-900 mb-1">
                  {capitalizedPlan}
                </Text>
                <Text className="text-sm text-red-700">
                  Access ends on {formattedDate}
                </Text>
              </Section>

              {/* What Happens Next */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  What happens next?
                </Heading>
                <Text className="text-gray-600 mb-3">
                  You'll continue to have full access to {capitalizedPlan}{" "}
                  features until {formattedDate}. After that:
                </Text>
                <Text className="text-gray-600 mb-0">
                  • Your account will revert to the Free plan
                  <br />
                  • You can still access basic features
                  <br />
                  • Your data will be preserved
                  <br />• You can reactivate anytime
                </Text>
              </Section>

              {/* Reactivate Section */}
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Changed your mind?
                </Text>
                <Text className="text-sm text-gray-600 mb-3">
                  You can reactivate your subscription at any time before{" "}
                  {formattedDate} to keep your premium features.
                </Text>
                <Button
                  href={billingUrl}
                  className="bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg inline-block text-sm"
                >
                  Reactivate Subscription
                </Button>
              </Section>

              {/* Feedback */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  We'd love your feedback
                </Heading>
                <Text className="text-gray-600">
                  Could you let us know why you cancelled? Your feedback helps
                  us improve. Reply to this email or contact us at{" "}
                  <Link
                    href={`mailto:${supportEmail}`}
                    className="text-blue-600 underline"
                  >
                    {supportEmail}
                  </Link>
                </Text>
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

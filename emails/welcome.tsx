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

interface WelcomeEmailProps {
  plan: string;
  redirectUrl: string;
  supportEmail: string;
}

export default function WelcomeEmail({
  plan = "Premium",
  redirectUrl = "https://handicappin.com/",
  supportEmail = "sebastiansole@handicappin.com",
}: WelcomeEmailProps) {
  const capitalizedPlan = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <Html>
      <Head />
      <Preview>
        Welcome to Handicappin' {capitalizedPlan} - Let's get started!
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Welcome to Handicappin'!
              </Heading>
              <Text className="text-gray-600 mb-6">
                Thank you for subscribing to {capitalizedPlan}. We're excited to
                help you track and improve your golf game!
              </Text>

              {/* Success Box */}
              <Section className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-1">Your Plan</Text>
                <Text className="text-2xl font-bold text-gray-900 mb-2">
                  {capitalizedPlan}
                </Text>
                <Text className="text-sm text-green-700">
                  ✓ Your account is now active
                </Text>
              </Section>

              {/* What's Included */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  What's included with {capitalizedPlan}?
                </Heading>
                <Text className="text-gray-600 mb-0">
                  {plan === "unlimited" || plan === "lifetime" ? (
                    <>
                      • Unlimited round tracking
                      <br />
                      • Unlimited handicap calculations
                      <br />
                      • Advanced analytics and insights
                      <br />
                      • Performance trends and history
                      <br />• Priority support
                    </>
                  ) : (
                    <>
                      • Unlimited round tracking
                      <br />
                      • Automatic handicap calculations
                      <br />
                      • Performance tracking
                      <br />
                      • Historical data and trends
                      <br />• Email support
                    </>
                  )}
                </Text>
              </Section>

              {/* Get Started Section */}
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  Ready to get started?
                </Text>
                <Text className="text-sm text-gray-600 mb-3">
                  Head to your dashboard to start tracking your rounds and
                  calculating your handicap.
                </Text>
                <Button
                  href={redirectUrl}
                  className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg inline-block"
                >
                  Go to Homepage
                </Button>
              </Section>

              {/* Quick Start Guide */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  Quick start guide
                </Heading>
                <Text className="text-gray-600 mb-3">
                  Here's how to make the most of your subscription:
                </Text>
                <Text className="text-gray-600 mb-0">
                  1. <strong>Add your first round</strong> - Enter your scores
                  from a recent game
                  <br />
                  2. <strong>Track your progress</strong> - Watch your handicap
                  update automatically
                  <br />
                  3. <strong>View analytics</strong> - See detailed insights
                  about your performance
                  <br />
                  4. <strong>Set goals</strong> - Track your improvement over
                  time
                </Text>
              </Section>

              {/* Support Section */}
              <Section className="border-t border-gray-200 pt-6">
                <Text className="text-sm text-gray-600 mb-2">
                  <strong>Need help getting started?</strong>
                </Text>
                <Text className="text-sm text-gray-600">
                  We're here to help! If you have any questions or need
                  assistance, reach out to us at{" "}
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

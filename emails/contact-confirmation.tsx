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

interface ContactConfirmationEmailProps {
  name: string;
  supportEmail: string;
}

export default function ContactConfirmationEmail({
  name = "John",
  supportEmail = "sebastiansole@handicappin.com",
}: ContactConfirmationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>
        We received your message - Handicappin' Support
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                We Got Your Message!
              </Heading>
              <Text className="text-gray-600 mb-6">
                Hi {name}, thank you for reaching out to us. We've received your
                message and will get back to you as soon as possible.
              </Text>

              {/* Confirmation Box */}
              <Section className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-green-700 mb-0">
                  Your message has been received and is being reviewed by our
                  team.
                </Text>
              </Section>

              {/* Response Time */}
              <Section className="mb-6">
                <Heading className="text-lg font-semibold text-gray-900 mb-2">
                  What happens next?
                </Heading>
                <Text className="text-gray-600 mb-0">
                  We typically respond within <strong>24 hours</strong> during
                  business days. If your inquiry is urgent, please mention it in
                  your message and we'll prioritize your request.
                </Text>
              </Section>

              {/* While You Wait */}
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm font-semibold text-gray-900 mb-2">
                  While you wait...
                </Text>
                <Text className="text-sm text-gray-600 mb-3">
                  Check out our FAQ section for answers to common questions
                  about handicap calculations and how to use Handicappin'.
                </Text>
                <Button
                  href="https://handicappin.com/contact#faq"
                  className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg inline-block text-sm"
                >
                  View FAQ
                </Button>
              </Section>

              {/* Contact Info */}
              <Section className="border-t border-gray-200 pt-6">
                <Text className="text-sm text-gray-600 mb-2">
                  <strong>Need immediate assistance?</strong>
                </Text>
                <Text className="text-sm text-gray-600">
                  You can also reach us directly at{" "}
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
                  This is an automated confirmation from Handicappin'. Please do
                  not reply to this email.
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

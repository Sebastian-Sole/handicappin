import {
  Body,
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

interface ContactFormEmailProps {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactFormEmail({
  name = "John Doe",
  email = "john@example.com",
  subject = "Question about handicap tracking",
  message = "I have a question about how the handicap calculation works. Can you explain the process?",
}: ContactFormEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>New contact form submission from {name}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                New Contact Form Submission
              </Heading>
              <Text className="text-gray-600 mb-6">
                You received a new message from the Handicappin' contact form.
              </Text>

              {/* Contact Details */}
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-1">From</Text>
                <Text className="text-lg font-semibold text-gray-900 mb-0">
                  {name}
                </Text>
                <Link
                  href={`mailto:${email}`}
                  className="text-blue-600 underline text-sm"
                >
                  {email}
                </Link>
              </Section>

              {/* Subject */}
              <Section className="mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-1">
                  Subject
                </Text>
                <Text className="text-gray-900 mb-0">{subject}</Text>
              </Section>

              {/* Message */}
              <Section className="mb-6">
                <Text className="text-sm font-semibold text-gray-600 mb-1">
                  Message
                </Text>
                <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <Text className="text-gray-900 whitespace-pre-wrap mb-0">
                    {message}
                  </Text>
                </Section>
              </Section>

              {/* Reply Action */}
              <Section className="border-t border-gray-200 pt-6">
                <Text className="text-sm text-gray-600 mb-2">
                  <strong>Reply directly:</strong>
                </Text>
                <Link
                  href={`mailto:${email}?subject=Re: ${encodeURIComponent(subject)}`}
                  className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg inline-block text-sm"
                >
                  Reply to {name}
                </Link>
              </Section>

              {/* Footer */}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center mb-2">
                  This email was sent from the Handicappin' contact form.
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

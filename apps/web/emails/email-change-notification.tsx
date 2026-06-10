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

interface EmailChangeNotificationProps {
  cancelUrl: string;
  newEmail: string; // Masked: ne****@example.com
  oldEmail: string;
}

export default function EmailChangeNotification({
  cancelUrl = "https://handicappin.com/cancel-email-change?token=abc123",
  newEmail = "ne****@example.com",
  oldEmail = "old@example.com",
}: EmailChangeNotificationProps) {
  return (
    <Html>
      <Head />
      <Preview>Email change requested for your Handicappin' account</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Email Change Requested
              </Heading>
              <Text className="text-gray-600 mb-6">
                We received a request to change the email address for your
                Handicappin' account.
              </Text>

              {/* Warning Box */}
              <Section className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-1">
                  Security Alert
                </Text>
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Current email:</strong> {oldEmail}
                </Text>
                <Text className="text-sm text-gray-700 mb-0">
                  <strong>Requested new email:</strong> {newEmail}
                </Text>
              </Section>

              {/* What Happens Next */}
              <Text className="text-gray-700 mb-4">
                <strong>What happens next:</strong>
              </Text>
              <ul className="text-gray-700 pl-4 mb-6">
                <li className="mb-2">
                  A verification email was sent to the new email address
                </li>
                <li className="mb-2">
                  Your email will only change after the new address is verified
                </li>
                <li className="mb-2">
                  You'll continue to receive emails at <strong>{oldEmail}</strong>{" "}
                  until verification is complete
                </li>
              </ul>

              {/* Didn't Request Section */}
              <Section className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-red-900 mb-2">
                  <strong>I didn't request this!</strong>
                </Text>
                <Text className="text-sm text-gray-700 mb-4">
                  If you didn't request this email change, click the button below
                  to cancel it immediately and secure your account.
                </Text>
                <Button
                  href={cancelUrl}
                  className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold no-underline"
                >
                  Cancel Email Change
                </Button>
              </Section>

              {/* Alternative Cancel Link */}
              <Text className="text-sm text-gray-600 mb-6">
                Or copy and paste this link into your browser:
                <br />
                <Link href={cancelUrl} className="text-blue-600 break-all">
                  {cancelUrl}
                </Link>
              </Text>

              {/* Security Best Practices */}
              <Section className="border-t border-gray-200 pt-6 mt-6">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Security Best Practices:</strong>
                </Text>
                <ul className="text-sm text-gray-600 pl-4 mb-4">
                  <li>Never share your password with anyone</li>
                  <li>Use a strong, unique password for your account</li>
                  <li>
                    If you suspect unauthorized access, change your password
                    immediately
                  </li>
                </ul>
              </Section>

              {/* Footer */}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center">
                  This security notification was sent to {oldEmail}
                  <br />
                  Need help? Contact{" "}
                  <Link
                    href="mailto:sebastiansole@handicappin.com"
                    className="text-blue-600"
                  >
                    sebastiansole@handicappin.com
                  </Link>
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

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

interface EmailVerificationChangeProps {
  verificationUrl: string;
  oldEmail: string;
  newEmail: string;
  expiresInHours: number;
}

export default function EmailVerificationChange({
  verificationUrl = "https://handicappin.com/verify-email-change?token=abc123",
  oldEmail = "old@example.com",
  newEmail = "new@example.com",
  expiresInHours = 48,
}: EmailVerificationChangeProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your new email address for Handicappin'</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Verify Your New Email Address
              </Heading>
              <Text className="text-gray-600 mb-6">
                You recently requested to change your email address from{" "}
                <strong>{oldEmail}</strong> to <strong>{newEmail}</strong>.
              </Text>

              {/* Info Box */}
              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-1">
                  New Email Address
                </Text>
                <Text className="text-xl font-bold text-gray-900 mb-0">
                  {newEmail}
                </Text>
              </Section>

              {/* Instructions */}
              <Text className="text-gray-700 mb-4">
                To complete this change, please verify your new email address by
                clicking the button below:
              </Text>

              {/* CTA Button */}
              <Section className="text-center my-8">
                <Button
                  href={verificationUrl}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold no-underline"
                >
                  Verify New Email Address
                </Button>
              </Section>

              {/* Alternative Link */}
              <Text className="text-sm text-gray-600 mb-6">
                Or copy and paste this link into your browser:
                <br />
                <Link href={verificationUrl} className="text-blue-600 break-all">
                  {verificationUrl}
                </Link>
              </Text>

              {/* Important Info */}
              <Section className="border-t border-gray-200 pt-6 mt-6">
                <Text className="text-sm text-gray-600 mb-2">
                  <strong>Important:</strong>
                </Text>
                <ul className="text-sm text-gray-600 pl-4 mb-4">
                  <li>This link will expire in {expiresInHours} hours</li>
                  <li>
                    Your email address will only change after verification
                  </li>
                  <li>
                    A notification was sent to your old email address (
                    {oldEmail})
                  </li>
                  <li>
                    You can cancel this change by clicking the link in that
                    notification
                  </li>
                </ul>
              </Section>

              {/* Didn't Request */}
              <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Didn't request this change?</strong>
                </Text>
                <Text className="text-sm text-gray-600 mb-0">
                  If you didn't request this email change, you can safely ignore
                  this message. Your email address will not be changed unless you
                  click the verification link above.
                </Text>
              </Section>

              {/* Footer */}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center">
                  This email was sent by Handicappin' to {newEmail}
                  <br />
                  If you need assistance, contact{" "}
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

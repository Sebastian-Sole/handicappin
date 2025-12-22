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
  Hr,
} from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import * as React from "https://esm.sh/react@18.2.0";

interface EmailVerificationChangeProps {
  otp: string;
  oldEmail: string;
  newEmail: string;
  expiresInHours?: number;
}

export default function EmailVerificationChange({
  otp,
  oldEmail,
  newEmail,
  expiresInHours = 48,
}: EmailVerificationChangeProps) {
  return (
    <Html>
      <Head />
      <Preview>Verify your email change - Your code is {otp}</Preview>
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

              {/* OTP Display */}
              <Section className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-center">
                <Text className="text-sm text-gray-600 mb-2 uppercase tracking-wide">
                  Your Verification Code
                </Text>
                <Text className="text-4xl font-bold text-gray-900 tracking-widest mb-0 font-mono">
                  {otp}
                </Text>
              </Section>

              {/* Instructions */}
              <Text className="text-gray-700 mb-4">
                Enter this code on the verification page to complete your email
                change. This code will expire in{" "}
                <strong>{expiresInHours} hours</strong>.
              </Text>

              {/* Security Info */}
              <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Security Tips:</strong>
                </Text>
                <ul className="text-sm text-gray-600 pl-4 mb-0">
                  <li>Never share this code with anyone</li>
                  <li>
                    Handicappin' will never ask for this code via phone or email
                  </li>
                  <li>This code can only be used once</li>
                </ul>
              </Section>

              {/* Important Info */}
              <Hr className="border border-solid border-gray-200 my-6" />
              <Text className="text-sm text-gray-600 mb-2">
                <strong>Important:</strong>
              </Text>
              <ul className="text-sm text-gray-600 pl-4 mb-4">
                <li>Your email address will only change after verification</li>
                <li>
                  A notification was sent to your old email address ({oldEmail})
                </li>
                <li>You can cancel this change from your account settings</li>
              </ul>

              {/* Didn't Request */}
              <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-6">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Didn't request this change?</strong>
                </Text>
                <Text className="text-sm text-gray-600 mb-0">
                  If you didn't request this email change, you can safely ignore
                  this message. Your email address will not be changed unless
                  you click the verification link above.
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

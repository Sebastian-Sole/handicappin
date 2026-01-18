import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
  Hr,
} from "@react-email/components";

interface AccountDeletionOtpEmailProps {
  otp: string;
  email: string;
  expiresInMinutes?: number;
}

AccountDeletionOtpEmail.PreviewProps = {
  otp: "123456",
  email: "user@example.com",
  expiresInMinutes: 15,
} as AccountDeletionOtpEmailProps;

export default function AccountDeletionOtpEmail({
  otp,
  email,
  expiresInMinutes = 15,
}: AccountDeletionOtpEmailProps) {

  return (
    <Html>
      <Head />
      <Preview>Confirm your account deletion - {otp}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-red-600 mb-2">
                Confirm Account Deletion
              </Heading>

              <Text className="text-gray-700 mb-4">
                You requested to permanently delete your Handicappin&apos; account.
              </Text>

              {/* Warning */}
              <Section className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                <Text className="text-red-700 font-medium mb-2">
                  This action cannot be undone.
                </Text>
                <Text className="text-gray-700 text-sm mb-0">
                  All your data including your profile, rounds, and scores will be
                  permanently deleted. Any active subscriptions will be cancelled.
                </Text>
              </Section>

              {/* OTP Display */}
              <Section className="bg-red-50 border-2 border-red-200 rounded-lg p-6 mb-6 text-center">
                <Text className="text-sm text-gray-600 mb-2 uppercase tracking-wide">
                  Your Verification Code
                </Text>
                <Text className="text-4xl font-bold text-red-600 tracking-widest mb-0 font-mono">
                  {otp}
                </Text>
              </Section>

              {/* Instructions */}
              <Text className="text-gray-700 mb-4">
                Enter this code to confirm the deletion of your account. This code will
                expire in <strong>{expiresInMinutes} minutes</strong>.
              </Text>

              {/* Security Info */}
              <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Security Tips:</strong>
                </Text>
                <ul className="text-sm text-gray-600 pl-4 mb-0">
                  <li>Never share this code with anyone</li>
                  <li>Handicappin&apos; will never ask for this code via phone</li>
                  <li>This code can only be used once</li>
                </ul>
              </Section>

              {/* Didn&apos;t Request */}
              <Hr className="border border-solid border-gray-200 my-6" />
              <Text className="text-sm text-gray-600 mb-0">
                If you did not request this deletion, you can safely ignore this email.
                Your account will remain active and secure.
              </Text>

              {/* Footer */}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center">
                  This email was sent by Handicappin&apos; to {email}
                  <br />
                  &copy; 2025 Handicappin&apos;. All rights reserved.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

export { AccountDeletionOtpEmail };

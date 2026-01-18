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
} from "@react-email/components";

interface AccountDeletedEmailProps {
  email: string;
}

AccountDeletedEmail.PreviewProps = {
  email: "user@example.com",
} as AccountDeletedEmailProps;

export default function AccountDeletedEmail({ email }: AccountDeletedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your Handicappin&apos; account has been deleted</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Account Deleted
              </Heading>

              {/* Main Content */}
              <Text className="text-gray-700 mb-4">
                This email confirms that your Handicappin&apos; account associated with{" "}
                <strong>{email}</strong> has been permanently deleted.
              </Text>

              <Text className="text-gray-700 mb-4">
                All your data including your profile, rounds, and scores have been
                removed from our systems. Any active subscriptions have been cancelled.
              </Text>

              {/* Security Notice */}
              <Section className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-700 mb-0">
                  <strong>Did not request this?</strong> If you did not request this
                  deletion, please contact us immediately at{" "}
                  <Link href="mailto:support@handicappin.com" className="text-blue-600">
                    support@handicappin.com
                  </Link>
                </Text>
              </Section>

              <Hr className="border border-solid border-gray-200 my-6" />

              {/* Farewell */}
              <Text className="text-sm text-gray-600 mb-0">
                We&apos;re sorry to see you go. If you ever want to return, you&apos;re
                always welcome to create a new account at{" "}
                <Link href="https://handicappin.com" className="text-blue-600">
                  handicappin.com
                </Link>
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

export { AccountDeletedEmail };

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Text,
  Tailwind,
  Section,
  Preview,
  Hr,
} from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import * as React from "https://esm.sh/react@18.2.0";

interface EmailProps {
  otp: string;
  username: string;
  expiresInMinutes?: number;
}

export const Email = ({
  otp,
  username,
  expiresInMinutes = 15,
}: EmailProps) => {
  const formattedOTP = `${otp.slice(0, 3)}-${otp.slice(3)}`;

  return (
    <React.Fragment>
      <Html>
        <Head />
        <Preview>Reset your password - Your code is {formattedOTP}</Preview>
        <Tailwind>
          <Body className="bg-gray-50 font-sans">
            <Container className="mx-auto py-8 px-4 max-w-xl">
              <Section className="bg-white rounded-lg shadow-sm p-8">
                <Heading className="text-2xl font-bold text-gray-900 mb-2">
                  Reset Your Password
                </Heading>
                <Text className="text-gray-600 mb-6">
                  Hello {username}, we received a request to reset your
                  password. Use the verification code below to continue:
                </Text>

                {/* OTP Display */}
                <Section className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6 text-center">
                  <Text className="text-sm text-gray-600 mb-2 uppercase tracking-wide">
                    Your Verification Code
                  </Text>
                  <Text className="text-4xl font-bold text-gray-900 tracking-widest mb-0 font-mono">
                    {formattedOTP}
                  </Text>
                </Section>

                <Text className="text-gray-700 mb-4">
                  Enter this code on the password reset page to continue. This
                  code will expire in{" "}
                  <strong>{expiresInMinutes} minutes</strong>.
                </Text>

                <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <Text className="text-sm text-gray-700 mb-2">
                    <strong>Security Tips:</strong>
                  </Text>
                  <ul className="text-sm text-gray-600 pl-4 mb-0">
                    <li>Never share this code with anyone</li>
                    <li>Handicappin' will never ask for this code via phone</li>
                    <li>This code can only be used once</li>
                  </ul>
                </Section>

                <Hr className="border border-solid border-gray-200 my-6" />
                <Text className="text-sm text-gray-600 mb-0">
                  If you didn't request this password reset, you can safely
                  ignore this email. Your password will not be changed.
                </Text>
              </Section>
            </Container>
          </Body>
        </Tailwind>
      </Html>
    </React.Fragment>
  );
};

export default Email;

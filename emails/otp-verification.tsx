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

interface OtpVerificationEmailProps {
  otp: string;
  email: string;
  otpType: "signup" | "email_change" | "password_reset";
  expiresInMinutes?: number;
}

const OTP_TYPE_TITLES = {
  signup: "Verify Your Email",
  email_change: "Verify Your New Email",
  password_reset: "Reset Your Password",
};

const OTP_TYPE_DESCRIPTIONS = {
  signup: "Thank you for signing up! To complete your registration, please use the verification code below:",
  email_change: "You requested to change your email address. Please use the verification code below to confirm:",
  password_reset: "You requested to reset your password. Please use the verification code below to continue:",
};

OtpVerificationEmail.PreviewProps = {
  otp: "123456",
  email: "user@example.com",
  otpType: "signup",
  expiresInMinutes: 15,
} as OtpVerificationEmailProps;

export default function OtpVerificationEmail({
  otp,
  email,
  otpType,
  expiresInMinutes = 15,
}: OtpVerificationEmailProps) {
  const formattedOTP = `${otp.slice(0, 3)}-${otp.slice(3)}`;

  return (
    <Html>
      <Head />
      <Preview>{OTP_TYPE_TITLES[otpType]} - Your code is {formattedOTP}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              {/* Header */}
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                {OTP_TYPE_TITLES[otpType]}
              </Heading>
              <Text className="text-gray-600 mb-6">
                {OTP_TYPE_DESCRIPTIONS[otpType]}
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

              {/* Instructions */}
              <Text className="text-gray-700 mb-4">
                Enter this code on the verification page to continue. This code will expire in{" "}
                <strong>{expiresInMinutes} minutes</strong>.
              </Text>

              {/* Security Info */}
              <Section className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Security Tips:</strong>
                </Text>
                <ul className="text-sm text-gray-600 pl-4 mb-0">
                  <li>Never share this code with anyone</li>
                  <li>Handicappin' will never ask for this code via phone or email</li>
                  <li>This code can only be used once</li>
                </ul>
              </Section>

              {/* Didn't Request */}
              <Hr className="border border-solid border-gray-200 my-6" />
              <Text className="text-sm text-gray-600 mb-0">
                If you didn't request this code, you can safely ignore this email.
                Your account security is important to us - if you're concerned, please
                contact us at{" "}
                <a href="mailto:sebastiansole@handicappin.com" className="text-blue-600">
                  sebastiansole@handicappin.com
                </a>
              </Text>

              {/* Footer */}
              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center">
                  This email was sent by Handicappin' to {email}
                  <br />
                  © 2025 Handicappin'. All rights reserved.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

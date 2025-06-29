import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Text,
  Tailwind,
  Button,
  Section,
} from "https://esm.sh/@react-email/components@0.0.22?deps=react@18.2.0";
import * as React from "https://esm.sh/react@18.2.0";

interface EmailProps {
  resetLink: string;
  username: string;
}

export const Email = ({ resetLink, username }: EmailProps) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans px-2">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              Reset Password Request
            </Heading>
            <Text className="text-black text-[14px] leading-[24px]">
              Hello {username},
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              A request was made to reset the password for your account on{" "}
              {new Date().toLocaleString()}. If you did not make this request,
              you can safely ignore this email. Click the button below to reset
              your password:
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
                href={`${resetLink}`}
              >
                Reset your password
              </Button>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default Email;

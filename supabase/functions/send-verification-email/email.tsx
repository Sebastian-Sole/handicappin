import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Text,
  Preview,
} from "https://esm.sh/@react-email/components@0.0.22";
import * as React from "https://esm.sh/react@18.2.0";

interface EmailProps {
  username: string;
  supabase_url: string;
  token: string;
  token_hash: string;
  redirect_to: string;
  email_action_type: string;
}

export const Email = ({
  username,
  supabase_url,
  token,
  token_hash,
  redirect_to,
  email_action_type,
}: EmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Log in with this magic link</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Login</Heading>
          <Link
            href={`${supabase_url}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}verify-email`}
            target="_blank"
            style={{
              ...link,
              display: "block",
              marginBottom: "16px",
            }}
          >
            Click here to log in with this magic link
          </Link>
          <Text style={{ ...text, marginBottom: "14px" }}>
            Or, copy and paste this temporary login code:
          </Text>
          <code style={code}>{token}</code>
          <Text
            style={{
              ...text,
              color: "#ababab",
              marginTop: "14px",
              marginBottom: "16px",
            }}
          >
            If you didn&apos;t try to login, you can safely ignore this email.
          </Text>
          <Text style={footer}>
            <Link
              href="https://demo.vercel.store/"
              target="_blank"
              style={{ ...link, color: "#898989" }}
            >
              ACME Corp
            </Link>
            , the famouse demo corp.
          </Text>
        </Container>
      </Body>
    </Html>

    // <Html>
    //   <Head />
    //   <Tailwind>
    //     <Body className="bg-white my-auto mx-auto font-sans px-2">
    //       <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] max-w-[465px]">
    //         <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
    //           Verify your email
    //         </Heading>
    //         <Text className="text-black text-[14px] leading-[24px]">
    //           Hello {username},
    //         </Text>
    //         <Text className="text-black text-[14px] leading-[24px]">
    //           Thank you for signing up! To complete your registration, please
    //           verify your email address by clicking the button below:
    //         </Text>
    //         <Section className="text-center mt-[32px] mb-[32px]">
    //           <Button
    //             className="bg-[#000000] rounded text-white text-[12px] font-semibold no-underline text-center px-5 py-3"
    //             href={confirmationUrl}
    //           >
    //             Verify your email
    //           </Button>
    //         </Section>
    //         <Text className="text-black text-[14px] leading-[24px]">
    //           or copy and paste this URL into your browser:{" "}
    //           <Link
    //             href={confirmationUrl}
    //             className="text-blue-600 no-underline"
    //           >
    //             {confirmationUrl}
    //           </Link>
    //         </Text>
    //         <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
    //         <Text className="text-[#666666] text-[12px] leading-[24px]">
    //           This invitation was intended for{" "}
    //           <span className="text-black">{username}</span>. If you were not
    //           expecting this invitation, you can ignore this email. If you are
    //           concerned about your account&apos;s safety, please reply to this
    //           email to get in touch with us.
    //         </Text>
    //       </Container>
    //     </Body>
    //   </Tailwind>
    // </Html>
  );
};

const main = {
  backgroundColor: "#ffffff",
};

const container = {
  paddingLeft: "12px",
  paddingRight: "12px",
  margin: "0 auto",
};

const h1 = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
};

const link = {
  color: "#2754C5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "14px",
  textDecoration: "underline",
};

const text = {
  color: "#333",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "14px",
  margin: "24px 0",
};

const footer = {
  color: "#898989",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: "12px",
  lineHeight: "22px",
  marginTop: "12px",
  marginBottom: "24px",
};

const code = {
  display: "inline-block",
  padding: "16px 4.5%",
  width: "90.5%",
  backgroundColor: "#f4f4f4",
  borderRadius: "5px",
  border: "1px solid #eee",
  color: "#333",
};

// SignupVerificationEmail.PreviewProps = {
//   username: "alanturing",
//   confirmationUrl: "https://vercel.com/teams/invite/foo",
// } as SignupVerificationEmailProps;

export default Email;

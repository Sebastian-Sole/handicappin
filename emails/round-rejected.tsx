import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

interface RoundRejectedEmailProps {
  name?: string | null;
  courseName: string;
  teeName?: string;
  teePlayedAt?: Date | string;
  roundsUrl: string;
  supportEmail: string;
}

function formatDate(value: Date | string | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function RoundRejectedEmail({
  name = null,
  courseName = "St. Andrews Old Course",
  teeName = "White",
  teePlayedAt = "2026-04-10T12:00:00Z",
  roundsUrl = "https://handicappin.com/rounds",
  supportEmail = "sebastiansole@handicappin.com",
}: RoundRejectedEmailProps) {
  const playedOn = formatDate(teePlayedAt);
  const greeting = name ? `Hi ${name},` : "Hi,";

  return (
    <Html>
      <Head />
      <Preview>
        {`Your round at ${courseName} needs another look before it can count.`}
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-2xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              <Section className="mb-4">
                <table cellPadding={0} cellSpacing={0}>
                  <tbody>
                    <tr>
                      <td className="bg-amber-100 text-amber-800 text-[11px] font-semibold uppercase tracking-wide py-1 px-2.5 rounded-full">
                        Needs another look
                      </td>
                    </tr>
                  </tbody>
                </table>
              </Section>

              <Heading className="text-2xl font-bold text-gray-900 mb-2 mt-0">
                We couldn&apos;t approve this round
              </Heading>
              <Text className="text-gray-700 leading-relaxed mb-6">
                {greeting} thanks for submitting your round. After review we
                weren&apos;t able to approve it for your handicap index — usually
                this is because of a detail on the course or tee information
                that didn&apos;t check out. The good news: it&apos;s an easy fix.
              </Text>

              <Section className="mb-6">
                <Text className="text-xs text-gray-500 uppercase tracking-wide mb-1 mt-0">
                  Round details
                </Text>
                <Section className="border border-gray-200 rounded-lg p-4">
                  <Text className="text-lg font-semibold text-gray-900 mt-0 mb-3">
                    {courseName}
                  </Text>
                  <table
                    width="100%"
                    cellPadding={0}
                    cellSpacing={0}
                    style={{ borderCollapse: "collapse" }}
                  >
                    <tbody>
                      <tr>
                        {teeName ? (
                          <td className="pr-2 align-top">
                            <Text className="text-xs text-gray-500 uppercase tracking-wide mt-0 mb-0.5">
                              Tee
                            </Text>
                            <Text className="text-sm text-gray-900 mt-0 mb-0">
                              {teeName}
                            </Text>
                          </td>
                        ) : null}
                        {playedOn ? (
                          <td className="px-2 align-top">
                            <Text className="text-xs text-gray-500 uppercase tracking-wide mt-0 mb-0.5">
                              Played
                            </Text>
                            <Text className="text-sm text-gray-900 mt-0 mb-0">
                              {playedOn}
                            </Text>
                          </td>
                        ) : null}
                      </tr>
                    </tbody>
                  </table>
                </Section>
              </Section>

              <Section className="mb-6">
                <Text className="text-sm font-semibold text-gray-900 mb-3 mt-0">
                  Here&apos;s what you can do
                </Text>

                <Section className="border-l-4 border-blue-500 bg-blue-50 rounded-r-md py-3 px-4 mb-3">
                  <Text className="text-sm font-semibold text-gray-900 mt-0 mb-1">
                    Resubmit with corrected details
                  </Text>
                  <Text className="text-sm text-gray-700 mt-0 mb-0">
                    Double-check the course, tee, and hole data. Most rejections
                    come from tee ratings or hole pars that don&apos;t match the
                    course&apos;s official scorecard.
                  </Text>
                </Section>

                <Section className="border-l-4 border-gray-300 bg-gray-50 rounded-r-md py-3 px-4">
                  <Text className="text-sm font-semibold text-gray-900 mt-0 mb-1">
                    Think this was a mistake?
                  </Text>
                  <Text className="text-sm text-gray-700 mt-0 mb-0">
                    Reply to this email or reach out to{" "}
                    <a
                      href={`mailto:${supportEmail}`}
                      className="text-blue-600 underline"
                    >
                      {supportEmail}
                    </a>{" "}
                    and we&apos;ll take another look.
                  </Text>
                </Section>
              </Section>

              <Section className="text-center mb-6">
                <Button
                  href={roundsUrl}
                  className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg text-sm"
                >
                  Resubmit your round
                </Button>
              </Section>

              <Hr className="border-gray-200 my-4" />

              <Section className="mt-6 pt-2">
                <Text className="text-xs text-gray-500 text-center mb-0">
                  Handicappin&apos; — transparent, USGA-compliant handicap
                  tracking.
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

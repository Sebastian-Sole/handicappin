import {
  Body,
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

export type SubmissionSummary = {
  type: "new_course" | "new_tee" | "tee_edit";
  teeName: string;
  teeGender: string;
  submissionId?: number;
  teeId?: number;
  parentTeeId?: number | null;
};

interface AdminSubmissionNotificationEmailProps {
  submitterEmail: string;
  submitterName?: string | null;
  courseName: string;
  courseCity?: string | null;
  courseCountry?: string | null;
  courseId?: number;
  courseIsNew: boolean;
  submissions: SubmissionSummary[];
  roundId?: number;
}

const SUBMISSION_TYPE_LABEL: Record<SubmissionSummary["type"], string> = {
  new_course: "New course",
  new_tee: "New tee",
  tee_edit: "Tee edit",
};

export default function AdminSubmissionNotificationEmail({
  submitterEmail = "user@example.com",
  submitterName = "Anonymous Golfer",
  courseName = "St. Andrews Old Course",
  courseCity = "St. Andrews",
  courseCountry = "Scotland",
  courseId,
  courseIsNew = false,
  submissions = [
    { type: "new_tee", teeName: "Blue", teeGender: "male" },
  ],
  roundId,
}: AdminSubmissionNotificationEmailProps) {
  const submissionCount = submissions.length + (courseIsNew ? 1 : 0);
  const location = [courseCity, courseCountry].filter(Boolean).join(", ");
  const previewText = `${submissionCount} new submission${
    submissionCount === 1 ? "" : "s"
  } from ${submitterName ?? submitterEmail} for ${courseName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                New submission awaiting approval
              </Heading>
              <Text className="text-gray-600 mb-6">
                A user submitted course or tee data that needs admin review.
              </Text>

              <Section className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <Text className="text-sm text-gray-600 mb-1">Submitted by</Text>
                <Text className="text-lg font-semibold text-gray-900 mb-0">
                  {submitterName ?? submitterEmail}
                </Text>
                <Text className="text-sm text-gray-700 mb-0">
                  {submitterEmail}
                </Text>
              </Section>

              <Section className="mb-6">
                <Text className="text-sm font-semibold text-gray-600 mb-1">
                  Course
                </Text>
                <Text className="text-gray-900 mb-0">
                  {courseName}
                  {courseIsNew ? " (new)" : ""}
                </Text>
                {location ? (
                  <Text className="text-sm text-gray-600 mb-0">{location}</Text>
                ) : null}
                {courseId ? (
                  <Text className="text-xs text-gray-500 mb-0">
                    courseId: {courseId}
                  </Text>
                ) : null}
              </Section>

              <Hr className="border-gray-200 my-4" />

              <Section className="mb-4">
                <Text className="text-sm font-semibold text-gray-600 mb-2">
                  Submissions ({submissions.length})
                </Text>
                {submissions.map((submission, index) => (
                  <Section
                    key={index}
                    className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-2"
                  >
                    <Text className="text-sm font-semibold text-gray-900 mb-1">
                      {SUBMISSION_TYPE_LABEL[submission.type]} —{" "}
                      {submission.teeName} ({submission.teeGender})
                    </Text>
                    <Text className="text-xs text-gray-600 mb-0">
                      {submission.submissionId
                        ? `submissionId: ${submission.submissionId}`
                        : null}
                      {submission.teeId ? ` · teeId: ${submission.teeId}` : null}
                      {submission.parentTeeId
                        ? ` · parentTeeId: ${submission.parentTeeId}`
                        : null}
                    </Text>
                  </Section>
                ))}
              </Section>

              {roundId ? (
                <Section className="mb-4">
                  <Text className="text-xs text-gray-500 mb-0">
                    roundId: {roundId}
                  </Text>
                </Section>
              ) : null}

              <Section className="mt-6 pt-6 border-t border-gray-200">
                <Text className="text-sm text-gray-700 mb-2">
                  <strong>Next step:</strong> review the submission(s) and call{" "}
                  <code>approve_submission(submissionId)</code> or{" "}
                  <code>reject_submission(submissionId)</code> via the Supabase
                  SQL editor using the service role.
                </Text>
              </Section>

              <Section className="mt-8 pt-6 border-t border-gray-200">
                <Text className="text-xs text-gray-500 text-center mb-0">
                  Handicappin&apos; admin notification
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}

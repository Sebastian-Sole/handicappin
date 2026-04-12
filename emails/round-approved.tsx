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

interface ScorecardHole {
  holeNumber: number;
  par: number;
  hcp: number;
}

interface ScorecardData {
  holes: ScorecardHole[];
  scores: number[];
  outPar: number;
  inPar?: number;
  totalPar: number;
}

interface RoundApprovedEmailProps {
  name?: string | null;
  courseName: string;
  teeName?: string;
  teePlayedAt?: Date | string;
  adjustedGrossScore?: number;
  scoreDifferential?: number;
  roundsUrl: string;
  supportEmail: string;
  scorecard?: ScorecardData;
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

function buildSampleScorecard(): ScorecardData {
  const frontPars = [4, 5, 4, 3, 4, 4, 5, 3, 4];
  const backPars = [4, 4, 3, 5, 4, 4, 3, 5, 4];
  const frontHcps = [11, 1, 7, 17, 5, 13, 3, 15, 9];
  const backHcps = [10, 4, 18, 2, 12, 8, 16, 6, 14];
  const frontScores = [5, 6, 4, 3, 5, 4, 6, 4, 5];
  const backScores = [4, 5, 3, 6, 5, 4, 4, 6, 5];

  const pars = [...frontPars, ...backPars];
  const hcps = [...frontHcps, ...backHcps];
  const scores = [...frontScores, ...backScores];
  const holes: ScorecardHole[] = pars.map((par, i) => ({
    holeNumber: i + 1,
    par,
    hcp: hcps[i],
  }));

  return {
    holes,
    scores,
    outPar: frontPars.reduce((s, v) => s + v, 0),
    inPar: backPars.reduce((s, v) => s + v, 0),
    totalPar: pars.reduce((s, v) => s + v, 0),
  };
}

interface NineHoleTableProps {
  label: "OUT" | "IN";
  holes: ScorecardHole[];
  scores: number[];
  parTotal: number;
}

function NineHoleTable({ label, holes, scores, parTotal }: NineHoleTableProps) {
  const scoreTotal = scores.reduce((s, v) => s + v, 0);
  const headerCell =
    "bg-gray-100 text-[10px] font-semibold text-gray-600 uppercase border border-gray-200 py-1 text-center";
  const labelCell =
    "bg-gray-100 text-[10px] font-semibold text-gray-700 uppercase border border-gray-200 py-1 pl-1.5 text-left";
  const dataCell =
    "border border-gray-200 py-1 text-center text-[11px] text-gray-900";
  const totalCell =
    "border border-gray-200 py-1 text-center text-[11px] font-semibold text-gray-900 bg-gray-50";

  return (
    <table
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
      className="mb-3"
    >
      <colgroup>
        <col style={{ width: "18%" }} />
        {holes.map((hole) => (
          <col key={hole.holeNumber} style={{ width: "8.2%" }} />
        ))}
        <col style={{ width: "8.2%" }} />
      </colgroup>
      <thead>
        <tr>
          <th className={labelCell}>HOLE</th>
          {holes.map((hole) => (
            <th key={hole.holeNumber} className={headerCell}>
              {hole.holeNumber}
            </th>
          ))}
          <th className={`${headerCell} bg-gray-200 text-[9px]`}>{label}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className={labelCell}>PAR</td>
          {holes.map((hole) => (
            <td key={hole.holeNumber} className={dataCell}>
              {hole.par}
            </td>
          ))}
          <td className={totalCell}>{parTotal}</td>
        </tr>
        <tr>
          <td className={labelCell}>HCP</td>
          {holes.map((hole) => (
            <td key={hole.holeNumber} className={dataCell}>
              {hole.hcp}
            </td>
          ))}
          <td className={totalCell}></td>
        </tr>
        <tr>
          <td className={labelCell}>SCORE</td>
          {holes.map((hole, i) => (
            <td
              key={hole.holeNumber}
              className={`${dataCell} font-semibold bg-blue-50`}
            >
              {scores[i] || "-"}
            </td>
          ))}
          <td className={`${totalCell} bg-blue-100 text-blue-900`}>
            {scoreTotal}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function EmailScorecard({ scorecard, teeName }: { scorecard: ScorecardData; teeName?: string }) {
  const { holes, scores, outPar, inPar, totalPar } = scorecard;
  const is18 = holes.length === 18;

  const frontHoles = holes.slice(0, 9);
  const backHoles = is18 ? holes.slice(9, 18) : [];
  const frontScores = scores.slice(0, 9);
  const backScores = is18 ? scores.slice(9, 18) : [];

  const totalStrokes = scores.reduce((s, v) => s + v, 0);

  return (
    <Section className="mb-6">
      <Text className="text-sm font-semibold text-gray-700 mb-2 mt-0 uppercase tracking-wide">
        {teeName ? `${teeName} Tee — Scorecard` : "Scorecard"}
      </Text>

      <NineHoleTable
        label="OUT"
        holes={frontHoles}
        scores={frontScores}
        parTotal={outPar}
      />

      {is18 && inPar !== undefined ? (
        <NineHoleTable
          label="IN"
          holes={backHoles}
          scores={backScores}
          parTotal={inPar}
        />
      ) : null}

      <table
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ borderCollapse: "collapse", tableLayout: "fixed" }}
      >
        <tbody>
          <tr>
            <td className="bg-blue-600 text-white font-semibold text-sm py-2 pl-3 text-left rounded-l-md">
              TOTAL
            </td>
            <td className="bg-blue-600 text-white text-sm py-2 pr-3 text-right rounded-r-md">
              <span className="font-semibold">{totalStrokes}</span>
              <span className="text-blue-200"> / par {totalPar}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export default function RoundApprovedEmail({
  name = null,
  courseName = "St. Andrews Old Course",
  teeName = "White",
  teePlayedAt = "2026-04-10T12:00:00Z",
  adjustedGrossScore = 83,
  scoreDifferential = 10.5,
  roundsUrl = "https://handicappin.com/rounds",
  supportEmail = "sebastiansole@handicappin.com",
  scorecard = buildSampleScorecard(),
}: RoundApprovedEmailProps) {
  const playedOn = formatDate(teePlayedAt);
  const greeting = name ? `Hi ${name},` : "Hi,";

  return (
    <Html>
      <Head />
      <Preview>
        {`Your round at ${courseName} has been approved and counts toward your handicap.`}
      </Preview>
      <Tailwind>
        <Body className="bg-gray-50 font-sans">
          <Container className="mx-auto py-8 px-4 max-w-2xl">
            <Section className="bg-white rounded-lg shadow-sm p-8">
              <Heading className="text-2xl font-bold text-gray-900 mb-2">
                Your round has been approved
              </Heading>
              <Text className="text-gray-700 mb-6">
                {greeting} good news — the round you submitted has been reviewed
                and approved. It now counts toward your handicap index.
              </Text>

              <Section className="mb-4">
                <Text className="text-xs text-gray-500 uppercase tracking-wide mb-1 mt-0">
                  Course
                </Text>
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
                      {playedOn ? (
                        <td className="pr-2 align-top">
                          <Text className="text-xs text-gray-500 uppercase tracking-wide mt-0 mb-0.5">
                            Played
                          </Text>
                          <Text className="text-sm text-gray-900 mt-0 mb-0">
                            {playedOn}
                          </Text>
                        </td>
                      ) : null}
                      {typeof adjustedGrossScore === "number" ? (
                        <td className="px-2 align-top">
                          <Text className="text-xs text-gray-500 uppercase tracking-wide mt-0 mb-0.5">
                            Adj. gross score
                          </Text>
                          <Text className="text-sm text-gray-900 mt-0 mb-0">
                            {adjustedGrossScore}
                          </Text>
                        </td>
                      ) : null}
                      {typeof scoreDifferential === "number" ? (
                        <td className="pl-2 align-top">
                          <Text className="text-xs text-gray-500 uppercase tracking-wide mt-0 mb-0.5">
                            Differential
                          </Text>
                          <Text className="text-sm text-gray-900 mt-0 mb-0">
                            {scoreDifferential.toFixed(1)}
                          </Text>
                        </td>
                      ) : null}
                    </tr>
                  </tbody>
                </table>
              </Section>

              {scorecard ? (
                <EmailScorecard scorecard={scorecard} teeName={teeName} />
              ) : null}

              <Section className="text-center mb-6">
                <Button
                  href={roundsUrl}
                  className="bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg text-sm"
                >
                  View your rounds
                </Button>
              </Section>

              <Hr className="border-gray-200 my-4" />

              <Text className="text-sm text-gray-600">
                Questions? Reply to this email or contact{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-blue-600 underline"
                >
                  {supportEmail}
                </a>
                .
              </Text>

              <Section className="mt-8 pt-6 border-t border-gray-200">
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

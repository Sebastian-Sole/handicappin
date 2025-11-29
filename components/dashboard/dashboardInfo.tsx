import Link from "next/link";
import { Button } from "../ui/button";
import { H4, P } from "../ui/typography";

interface DashboardIndexProps {
  handicapIndex: number;
  header: string;
}

const DashboardIndex = ({ handicapIndex, header }: DashboardIndexProps) => {
  return (
    <div className="bg-card rounded-lg p-6 rounded-r-none	">
      <h2 className="text-2xl font-bold mb-4">Handicap</h2>
      <div className="text-6xl font-bold text-primary">{handicapIndex}</div>
      <p className="text-muted-foreground">Current Handicap</p>
      <div className="mt-0">
        <Link href={"/calculators"}>
          <Button variant="link" className="text-primary underline px-0 mb-10">
            How is my handicap calculated?{" "}
          </Button>
        </Link>

        <H4 className="mb-2!">{header}</H4>
        <P className="mt-4!">
          Handicappin&apos; believes in transparency and making golf accessible.
          It can be difficult to find accurate and consistent information on the
          calculations of scores, handicaps and the rules of golf online. We aim
          to be a reliable source of information and aim to ease the unnecessary
          confusion around golf.
        </P>
        <P>
          An easy, interactive way to understand the calculations behind
          handicaps and scoring can be viewed by clicking the button below, or
          by viewing a specific round&apos;s calculation.
        </P>
        <Link
          href={
            "https://www.usga.org/handicapping/roh/rules-of-handicapping.html#cshid=rule51a"
          }
          target="_blank"
        >
          <Button variant="link" className="text-primary underline px-0 mb-6">
            Click here to learn more
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default DashboardIndex;

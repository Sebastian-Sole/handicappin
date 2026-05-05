import Link from "next/link";
import { Button } from "../ui/button";
import { H2, H4, P } from "../ui/typography";

interface DashboardIndexProps {
  handicapIndex: number;
  header: string;
}

const DashboardIndex = ({ handicapIndex, header }: DashboardIndexProps) => {
  return (
    <div className="surface p-lg rounded-r-none	">
      <H2 className="mb-md">Handicap</H2>
      <div className="text-figure-3xl text-primary">{handicapIndex}</div>
      <p className="text-muted-foreground">Current Handicap</p>
      <div className="mt-0">
        <Link href={"/calculators"}>
          <Button variant="link" className="text-primary underline px-0 mb-2xl">
            How is my handicap calculated?{" "}
          </Button>
        </Link>

        <H4 className="mb-sm!">{header}</H4>
        <P className="mt-md!">
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
        <Link href={"/calculators"}>
          <Button variant="link" className="text-primary underline px-0 mb-lg">
            Click here to learn more
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default DashboardIndex;

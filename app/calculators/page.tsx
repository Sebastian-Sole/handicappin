import { CalculatorsPageClient } from "./client";

export const metadata = {
  title: "Golf Calculators | Handicappin",
  description:
    "WHS-compliant golf calculators for handicap index, score differential, course handicap, and more.",
};

const CalculatorsPage = async () => {
  return <CalculatorsPageClient />;
};

export default CalculatorsPage;

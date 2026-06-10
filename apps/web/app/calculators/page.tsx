import { CalculatorsPageClient } from "./client";
import { PageContainer } from "@/components/layout/page-container";

export const metadata = {
  title: "Golf Calculators | Handicappin",
  description:
    "WHS-compliant golf calculators for handicap index, score differential, course handicap, and more.",
};

const CalculatorsPage = async () => {
  return (
    <PageContainer>
      <CalculatorsPageClient />
    </PageContainer>
  );
};

export default CalculatorsPage;

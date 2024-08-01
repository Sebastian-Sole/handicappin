"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RoundWithCourse } from "@/types/database";
import { Tables } from "@/types/supabase";
import { Blockquote, H2, H3, Large, Muted, P } from "./ui/typography";
import Link from "next/link";
import { Separator } from "./ui/separator";
import HolesTable from "./round/calculation/holesTable";
import StatCalculationDisplay from "./round/calculation/statCalculationDisplay";
import {
  RoundCalculationProvider,
  useRoundCalculationContext,
} from "@/contexts/roundCalculationContext";
import CourseHandicapCalculationDisplay from "./round/calculation/courseHcpCalculationDisplay";
import AGSCalculationDisplay from "./round/calculation/AGSCalculationDisplay";
import ScoreDiffCalculationDisplay from "./round/calculation/ScoreDiffCalculationDisplay";

interface RoundCalculationProps {
  round: RoundWithCourse;
  holes: Tables<"Hole">[];
}

const RoundCalculationContent = () => {
  const { round, holes } = useRoundCalculationContext();
  return (
    <div className="container mx-auto px-4 sm:px-6 md:px-8 py-8 space-y-8">
      <section className="space-y-4">
        <H2>
          {`${round.courseName} - ${new Date(
            round.teeTime
          ).toDateString()} - Score: ${round.adjustedGrossScore}`}
        </H2>
        <H3>Hole-by-hole results</H3>
        <div className="bg-background rounded-lg border">
          <HolesTable holes={holes} />
        </div>
      </section>
      <StatCalculationDisplay />
      <Separator />
      <CourseHandicapCalculationDisplay />
      <Separator />
      <AGSCalculationDisplay />
      <Separator />
      <ScoreDiffCalculationDisplay />
    </div>
  );
};

export function RoundCalculation({ round, holes }: RoundCalculationProps) {
  return (
    <RoundCalculationProvider round={round} holes={holes}>
      <RoundCalculationContent />
    </RoundCalculationProvider>
  );
}

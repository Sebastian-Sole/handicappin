"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load the chart component - only downloads when rendered
// This reduces initial bundle size by ~150KB (Recharts library)
const ScoreBarChartDisplay = dynamic(
  () => import("./score-bar-chart-display"),
  {
    loading: () => <Skeleton className="w-full h-[300px] rounded-lg" />,
    ssr: false, // Charts don't need server-side rendering
  }
);

export default ScoreBarChartDisplay;

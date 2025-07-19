"use client";

import { useThemeColors } from "@/utils/theme-colors";

interface ScoreLegendProps {
  showLegend: boolean;
}

const ScoreLegend = ({ showLegend }: ScoreLegendProps) => {
  const colors = useThemeColors();

  if (!showLegend) return null;

  return (
    <div className="hidden md:flex text-sm flex-col items-start lg:flex-row lg:items-center lg:gap-3 xl:flex-col xl:items-start xl:gap-0 2xl:flex-row 2xl:items-center 2xl:gap-3">
      <div className="flex items-center gap-1">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: colors.barActive }}
        />
        <span className="text-muted-foreground">Handicap affected</span>
      </div>
      <div className="flex items-center gap-1">
        <div
          className="w-3 h-3 rounded-sm"
          style={{ backgroundColor: colors.barInactive }}
        />
        <span className="text-muted-foreground">Handicap not affected</span>
      </div>
    </div>
  );
};

export default ScoreLegend;

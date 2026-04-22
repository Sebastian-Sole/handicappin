"use client";

import { Card, CardContent } from "@/components/ui/card";
import { H2 } from "@/components/ui/typography";
import { StatDelta } from "@/components/ui/stat-delta";
import { cn } from "@/lib/utils";
import { formatGolfAge } from "@/lib/statistics/format-utils";
import type { PlayerTypeResult } from "@/types/statistics";

interface PlayerIdentityCardProps {
  playerType: PlayerTypeResult;
  currentHandicap: number;
  handicapChange: number;
  totalRounds: number;
  golfAgeDays: number;
  daysSinceLastRound: number;
}

export function PlayerIdentityCard({
  playerType,
  currentHandicap,
  handicapChange,
  totalRounds,
  golfAgeDays,
  daysSinceLastRound,
}: PlayerIdentityCardProps) {
  const formatHandicap = (handicap: number) => {
    if (!Number.isFinite(handicap)) return "N/A";
    return handicap.toFixed(1);
  };

  const getHandicapChangeText = (): string => {
    if (handicapChange === 0) return "No change";
    const direction = handicapChange < 0 ? "Down" : "Up";
    const absChange = Math.abs(handicapChange).toFixed(1);
    return `${direction} ${absChange} since starting`;
  };

  const getPlayNudge = (): { text: string; urgent: boolean } => {
    if (daysSinceLastRound === 0) return { text: "Played today!", urgent: false };
    if (daysSinceLastRound === 1) return { text: "Yesterday", urgent: false };
    if (daysSinceLastRound <= 7) return { text: `${daysSinceLastRound} days ago`, urgent: false };
    if (daysSinceLastRound <= 14) return { text: `${daysSinceLastRound} days ago`, urgent: false };
    return { text: `${daysSinceLastRound} days - time to play!`, urgent: true };
  };

  const playNudge = getPlayNudge();

  return (
    <Card className="mb-xl tint-primary overflow-hidden">
      <CardContent className="p-lg md:p-xl">
        {/* Player Type Hero */}
        <div className="text-center mb-lg">
          <div className="text-6xl md:text-7xl mb-sm">{playerType.emoji}</div>
          <H2 className="text-2xl md:text-figure-lg mb-sm">{playerType.name}</H2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {playerType.description}
          </p>
          <div className="mt-sm">
            <span className="inline-block px-sm py-xs bg-primary/10 rounded-full text-xs text-muted-foreground">
              {Math.round(playerType.confidence * 100)}% match
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md md:gap-lg mt-xl">
          {/* Handicap Index */}
          <div className="text-center p-md bg-background/50 rounded-lg border">
            <div className="flex items-center justify-center gap-sm">
              <span className="text-4xl md:text-figure-2xl">
                {formatHandicap(currentHandicap)}
              </span>
              {handicapChange !== 0 && (
                <StatDelta
                  value={handicapChange}
                  invert
                  iconOnly
                  className="text-lg"
                />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-xs">Handicap Index</p>
            <p className="text-xs text-muted-foreground">{getHandicapChangeText()}</p>
          </div>

          {/* Rounds & Golf Age */}
          <div className="text-center p-md bg-background/50 rounded-lg border">
            <div className="text-4xl md:text-figure-2xl">{totalRounds}</div>
            <p className="text-sm text-muted-foreground mt-xs">Total Rounds</p>
            <p className="text-xs text-muted-foreground">
              over {formatGolfAge(golfAgeDays)}
            </p>
          </div>

          {/* Last Played */}
          <div className="text-center p-md bg-background/50 rounded-lg border">
            <div
              className={cn(
                "text-4xl md:text-figure-2xl",
                playNudge.urgent && "text-warning"
              )}
            >
              {daysSinceLastRound > 0 ? daysSinceLastRound : "0"}
            </div>
            <p className="text-sm text-muted-foreground mt-xs">Days Since Round</p>
            <p
              className={cn(
                "text-xs",
                playNudge.urgent ? "text-warning font-medium" : "text-muted-foreground"
              )}
            >
              {playNudge.text}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
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
    if (handicap === 0) return "N/A";
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
    <Card className="mb-8 bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden">
      <CardContent className="p-6 md:p-8">
        {/* Player Type Hero */}
        <div className="text-center mb-6">
          <div className="text-6xl md:text-7xl mb-3">{playerType.emoji}</div>
          <h2 className="text-2xl md:text-3xl font-bold mb-2">{playerType.name}</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            {playerType.description}
          </p>
          <div className="mt-3">
            <span className="inline-block px-3 py-1 bg-primary/10 rounded-full text-xs text-muted-foreground">
              {Math.round(playerType.confidence * 100)}% match
            </span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8">
          {/* Handicap Index */}
          <div className="text-center p-4 bg-background/50 rounded-lg border">
            <div className="flex items-center justify-center gap-2">
              <span className="text-4xl md:text-5xl font-bold">
                {formatHandicap(currentHandicap)}
              </span>
              {handicapChange !== 0 && (
                <span
                  className={cn(
                    "text-lg",
                    handicapChange < 0 ? "text-green-600" : "text-red-600"
                  )}
                >
                  {handicapChange < 0 ? "↓" : "↑"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Handicap Index</p>
            <p className="text-xs text-muted-foreground">{getHandicapChangeText()}</p>
          </div>

          {/* Rounds & Golf Age */}
          <div className="text-center p-4 bg-background/50 rounded-lg border">
            <div className="text-4xl md:text-5xl font-bold">{totalRounds}</div>
            <p className="text-sm text-muted-foreground mt-1">Total Rounds</p>
            <p className="text-xs text-muted-foreground">
              over {formatGolfAge(golfAgeDays)}
            </p>
          </div>

          {/* Last Played */}
          <div className="text-center p-4 bg-background/50 rounded-lg border">
            <div
              className={cn(
                "text-4xl md:text-5xl font-bold",
                playNudge.urgent && "text-orange-500"
              )}
            >
              {daysSinceLastRound > 0 ? daysSinceLastRound : "0"}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Days Since Round</p>
            <p
              className={cn(
                "text-xs",
                playNudge.urgent ? "text-orange-500 font-medium" : "text-muted-foreground"
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

import { Card, CardContent } from "@/components/ui/card";
import { H3 } from "@/components/ui/typography";
import type { PlayerTypeResult } from "@/types/statistics";

interface PlayerTypeBadgeProps {
  playerType: PlayerTypeResult;
}

export function PlayerTypeBadge({ playerType }: PlayerTypeBadgeProps) {
  return (
    <Card className="tint-primary">
      <CardContent className="p-lg text-center">
        <div className="text-6xl mb-md">{playerType.emoji}</div>
        <H3 className="text-2xl font-bold mb-sm">{playerType.name}</H3>
        <p className="text-muted-foreground">{playerType.description}</p>
        <div className="mt-md flex justify-center">
          <div className="chip-muted text-xs">
            {Math.round(playerType.confidence * 100)}% match
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

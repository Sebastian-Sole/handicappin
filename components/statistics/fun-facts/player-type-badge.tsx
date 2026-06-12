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
        <div className="text-figure-3xl mb-md">{playerType.emoji}</div>
        <H3 className="text-figure mb-sm">{playerType.name}</H3>
        <p className="text-muted-foreground">{playerType.description}</p>
        <div className="mt-md flex justify-center">
          <div className="px-sm py-xs bg-primary/10 rounded-full text-meta">
            {Math.round(playerType.confidence * 100)}% match
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

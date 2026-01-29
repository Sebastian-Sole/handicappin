import { Card, CardContent } from "@/components/ui/card";
import type { PlayerTypeResult } from "@/types/statistics";

interface PlayerTypeBadgeProps {
  playerType: PlayerTypeResult;
}

export function PlayerTypeBadge({ playerType }: PlayerTypeBadgeProps) {
  return (
    <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
      <CardContent className="p-6 text-center">
        <div className="text-6xl mb-4">{playerType.emoji}</div>
        <h3 className="text-2xl font-bold mb-2">{playerType.name}</h3>
        <p className="text-muted-foreground">{playerType.description}</p>
        <div className="mt-4 flex justify-center">
          <div className="px-3 py-1 bg-primary/10 rounded-full text-xs">
            {Math.round(playerType.confidence * 100)}% match
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

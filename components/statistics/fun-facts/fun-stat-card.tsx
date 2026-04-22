import { Card, CardContent } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat-tile";

interface FunStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  emoji?: string;
}

export function FunStatCard({ title, value, subtitle, emoji }: FunStatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-md">
        <StatTile
          value={value}
          label={title}
          hint={subtitle}
          leading={emoji ? <span className="text-3xl">{emoji}</span> : undefined}
          size="lg"
        />
      </CardContent>
    </Card>
  );
}

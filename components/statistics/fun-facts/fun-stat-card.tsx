import { Card, CardContent } from "@/components/ui/card";

interface FunStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  emoji?: string;
}

export function FunStatCard({ title, value, subtitle, emoji }: FunStatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-md text-center">
        {emoji && <div className="text-3xl mb-sm">{emoji}</div>}
        <p className="text-figure-lg">{value}</p>
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

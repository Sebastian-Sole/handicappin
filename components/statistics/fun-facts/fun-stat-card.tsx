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
      <CardContent className="p-4 text-center">
        {emoji && <div className="text-3xl mb-2">{emoji}</div>}
        <p className="text-3xl font-bold">{value}</p>
        <p className="text-sm font-medium">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

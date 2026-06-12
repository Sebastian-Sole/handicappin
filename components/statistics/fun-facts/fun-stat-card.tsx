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
      <CardContent density="compact" className="text-center">
        {emoji && <div className="text-figure-lg mb-sm">{emoji}</div>}
        <p className="text-figure-lg">{value}</p>
        <p className="text-label-sm">{title}</p>
        {subtitle && <p className="text-meta text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

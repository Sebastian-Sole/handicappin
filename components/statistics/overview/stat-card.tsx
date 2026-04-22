import { Card, CardContent } from "@/components/ui/card";
import { StatDelta } from "@/components/ui/stat-delta";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-md">
        <p className="text-sm text-muted-foreground">{title}</p>
        <div className="flex items-baseline gap-sm">
          <p className="text-2xl font-bold">{value}</p>
          {trend && trend !== "neutral" && (
            <StatDelta
              value={trend === "down" ? -1 : 1}
              invert
              iconOnly
              className="text-sm"
            />
          )}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

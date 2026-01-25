import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  sparklineData?: number[];
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon,
  sparklineData,
  className,
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "p-4 md:p-5 transition-all duration-200 hover:shadow-md",
        "bg-card/50 backdrop-blur-sm border-border/50",
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs md:text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        {icon && <div className="text-primary/60">{icon}</div>}
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>

        {trend && trendValue && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md",
              trend === "down" &&
                "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
              trend === "up" &&
                "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
              trend === "neutral" && "text-muted-foreground bg-muted"
            )}
          >
            {trend === "down" && <TrendingDown className="h-3 w-3" />}
            {trend === "up" && <TrendingUp className="h-3 w-3" />}
            {trend === "neutral" && <Minus className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>

      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-3 h-8">
          <MiniSparkline data={sparklineData} trend={trend} />
        </div>
      )}
    </Card>
  );
}

// Simple SVG sparkline component
function MiniSparkline({
  data,
  trend,
}: {
  data: number[];
  trend?: "up" | "down" | "neutral";
}) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const width = 100;
  const height = 32;
  const padding = 2;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y =
        height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const strokeColor =
    trend === "down"
      ? "stroke-green-500"
      : trend === "up"
        ? "stroke-red-500"
        : "stroke-primary";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full"
      preserveAspectRatio="none"
    >
      <polyline
        points={points}
        fill="none"
        className={cn("stroke-2", strokeColor)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

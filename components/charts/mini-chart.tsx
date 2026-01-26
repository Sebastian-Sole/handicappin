"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Minus, ChevronRight } from "lucide-react";
import Link from "next/link";

interface MiniChartProps {
  title: string;
  data: { value: number; label: string; highlighted?: boolean }[];
  className?: string;
  showLabels?: boolean;
  linkTo?: string;
}

interface MiniLineChartProps extends MiniChartProps {
  currentValue?: number;
  previousValue?: number;
}

export function MiniBarChart({
  title,
  data,
  className,
  showLabels = false,
  linkTo,
}: MiniChartProps) {
  const highlightedCount = data.filter((d) => d.highlighted).length;
  const avgValue = data.length > 0
    ? data.reduce((sum, d) => sum + d.value, 0) / data.length
    : 0;
  const minValue = data.length > 0 ? Math.min(...data.map((d) => d.value)) : 0;
  const maxValue = data.length > 0 ? Math.max(...data.map((d) => d.value)) : 0;
  const range = maxValue - minValue || 1;

  const content = (
    <Card className={cn("group", linkTo && "cursor-pointer hover:bg-accent/50 transition-colors", className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        {linkTo && (
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Play 5+ rounds to see chart
          </p>
        ) : (
          <>
            {/* Chart */}
            <div className="flex items-end justify-between gap-1 h-16">
              {data.map((item, index) => {
                const height = ((item.value - minValue) / range) * 100;
                return (
                  <div
                    key={index}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <div
                      className={cn(
                        "w-full rounded-t transition-all duration-300",
                        item.highlighted ? "bg-primary" : "bg-muted-foreground/20"
                      )}
                      style={{ height: `${Math.max(height, 10)}%` }}
                    />
                    {showLabels && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Summary stats */}
            <div className="flex items-center justify-between text-xs border-t pt-2">
              <div className="text-muted-foreground">
                Best: <span className="text-foreground font-medium">{minValue.toFixed(1)}</span>
              </div>
              <div className="text-muted-foreground">
                Avg: <span className="text-foreground font-medium">{avgValue.toFixed(1)}</span>
              </div>
              <div className="text-muted-foreground">
                Counting: <span className="text-primary font-medium">{highlightedCount}</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (linkTo) {
    return <Link href={linkTo}>{content}</Link>;
  }

  return content;
}

export function MiniLineChart({
  title,
  data,
  className,
  currentValue,
  previousValue,
  linkTo,
}: MiniLineChartProps) {
  const values = data.map((d) => d.value);
  const min = data.length > 0 ? Math.min(...values) : 0;
  const max = data.length > 0 ? Math.max(...values) : 0;
  const range = max - min || 1;

  const width = 200;
  const height = 60;
  const padding = 4;

  const points = data.map((item, index) => {
    const x = padding + (index / (data.length - 1 || 1)) * (width - padding * 2);
    const y =
      height - padding - ((item.value - min) / range) * (height - padding * 2);
    return { x, y, value: item.value };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  // Determine trend for color
  const firstValue = values[0] ?? 0;
  const lastValue = values[values.length - 1] ?? 0;
  const isImproving = lastValue < firstValue;
  const change = previousValue && currentValue ? currentValue - previousValue : 0;

  // Generate unique gradient ID to prevent conflicts when multiple charts render
  const gradientId = `chartGradient-${title.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}`;

  const content = (
    <Card className={cn("group", linkTo && "cursor-pointer hover:bg-accent/50 transition-colors", className)}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {currentValue !== undefined && (
            <span
              className={cn(
                "text-sm font-medium",
                isImproving
                  ? "text-green-600 dark:text-green-400"
                  : "text-foreground"
              )}
            >
              {currentValue.toFixed(1)}
            </span>
          )}
          {linkTo && (
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {data.length < 2 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Play 5+ rounds to see trend
          </p>
        ) : (
          <>
            {/* Chart */}
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-16"
              preserveAspectRatio="none"
              role="img"
              aria-label={`${title} trend line showing values from ${min.toFixed(1)} to ${max.toFixed(1)}. ${isImproving ? "Improving trend." : "Current value trend."}`}
            >
              <title>{title}: Line chart showing handicap progression</title>
              {/* Gradient fill under line */}
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={
                      isImproving ? "rgb(34 197 94 / 0.2)" : "var(--primary)"
                    }
                    stopOpacity="0.2"
                  />
                  <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Fill area */}
              <path
                d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
                fill={`url(#${gradientId})`}
              />

              {/* Line */}
              <path
                d={pathD}
                fill="none"
                className={cn(
                  "stroke-2",
                  isImproving ? "stroke-green-500" : "stroke-primary"
                )}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* End point dot */}
              <circle
                cx={points[points.length - 1].x}
                cy={points[points.length - 1].y}
                r="3"
                className={cn(isImproving ? "fill-green-500" : "fill-primary")}
              />
            </svg>

            {/* Summary stats */}
            <div className="flex items-center justify-between text-xs border-t pt-2">
              <div className="text-muted-foreground">
                Low: <span className="text-foreground font-medium">{min.toFixed(1)}</span>
              </div>
              <div className="text-muted-foreground">
                High: <span className="text-foreground font-medium">{max.toFixed(1)}</span>
              </div>
              {change !== 0 && (
                <div className={cn(
                  "flex items-center gap-0.5 font-medium",
                  change < 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                )}>
                  {change < 0 ? (
                    <TrendingDown className="h-3 w-3" />
                  ) : (
                    <TrendingUp className="h-3 w-3" />
                  )}
                  {change > 0 ? "+" : ""}{change.toFixed(1)}
                </div>
              )}
              {change === 0 && previousValue && (
                <div className="flex items-center gap-0.5 text-muted-foreground">
                  <Minus className="h-3 w-3" />
                  No change
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );

  if (linkTo) {
    return <Link href={linkTo}>{content}</Link>;
  }

  return content;
}

"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatDecimal,
  formatWithSign,
} from "@/lib/statistics/format-utils";

type HoleDistribution = {
  eagleOrBetter: number;
  birdie: number;
  par: number;
  bogey: number;
  doubleOrWorse: number;
};

export interface HoleStat {
  holeNumber: number;
  par: number;
  playCount: number;
  avgStrokes: number;
  avgVsPar: number;
  best: number;
  worst: number;
  distribution: HoleDistribution;
}

interface CourseHoleTabsProps {
  holes: HoleStat[];
}

const distributionTotal = (d: HoleDistribution) =>
  d.eagleOrBetter + d.birdie + d.par + d.bogey + d.doubleOrWorse;

const fillForVsPar = (vsPar: number): string => {
  if (vsPar <= -0.5) return "var(--success)";
  if (vsPar < 0.5) return "var(--primary)";
  if (vsPar < 1.25) return "var(--warning)";
  return "var(--destructive)";
};

export function CourseHoleTabs({ holes }: CourseHoleTabsProps) {
  if (holes.length === 0) {
    return (
      <Card>
        <CardContent className="p-2xl text-center text-muted-foreground">
          <p className="text-body-sm">No hole-level data yet.</p>
        </CardContent>
      </Card>
    );
  }

  const avgChartData = holes.map((h) => ({
    hole: h.holeNumber,
    avgStrokes: Number(h.avgStrokes.toFixed(2)),
    par: h.par,
    vsPar: h.avgVsPar,
    fill: fillForVsPar(h.avgVsPar),
    playCount: h.playCount,
  }));

  const overallAvgPar =
    holes.reduce((sum, h) => sum + h.par, 0) / holes.length;

  const distChartData = holes.map((h) => {
    const total = distributionTotal(h.distribution) || 1;
    return {
      hole: h.holeNumber,
      "Eagle+": (h.distribution.eagleOrBetter / total) * 100,
      Birdie: (h.distribution.birdie / total) * 100,
      Par: (h.distribution.par / total) * 100,
      Bogey: (h.distribution.bogey / total) * 100,
      "Double+": (h.distribution.doubleOrWorse / total) * 100,
    };
  });

  return (
    <Tabs defaultValue="table" className="w-full">
      <TabsList>
        <TabsTrigger value="table">Table</TabsTrigger>
        <TabsTrigger value="avg">Avg score</TabsTrigger>
        <TabsTrigger value="distribution">Distribution</TabsTrigger>
      </TabsList>

      <TabsContent value="table">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table className="min-w-2xl">
              <TableHeader>
                <TableRow>
                  <TableHead>Hole</TableHead>
                  <TableHead className="text-right">Par</TableHead>
                  <TableHead className="text-right">Played</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                  <TableHead className="text-right">vs Par</TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    Best
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    Worst
                  </TableHead>
                  <TableHead className="text-right hidden lg:table-cell">
                    Distribution (E / B / P / Bg / D+)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holes.map((h) => {
                  const total = distributionTotal(h.distribution);
                  return (
                    <TableRow key={h.holeNumber}>
                      <TableCell className="font-medium">
                        {h.holeNumber}
                      </TableCell>
                      <TableCell className="text-right">{h.par}</TableCell>
                      <TableCell className="text-right">
                        {h.playCount}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDecimal(h.avgStrokes, 2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatWithSign(h.avgVsPar, 2)}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {h.best}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        {h.worst}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-meta text-muted-foreground">
                        {total === 0
                          ? "—"
                          : `${h.distribution.eagleOrBetter} / ${h.distribution.birdie} / ${h.distribution.par} / ${h.distribution.bogey} / ${h.distribution.doubleOrWorse}`}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="avg">
        <Card>
          <CardContent density="compact">
            <p className="text-body-sm text-muted-foreground mb-md">
              Average strokes per hole. Bars are color-coded by performance vs
              par; the dashed line is the average par across holes you&apos;ve
              played here.
            </p>
            <ChartContainer
              className="h-72 w-full"
              config={{
                avgStrokes: {
                  label: "Avg strokes",
                  color: "var(--primary)",
                },
              }}
            >
              <BarChart data={avgChartData} accessibilityLayer>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hole"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(_value, payload) => {
                        const row = payload?.[0]?.payload as
                          | (typeof avgChartData)[number]
                          | undefined;
                        if (!row) return "";
                        return `Hole ${row.hole} · Par ${row.par}`;
                      }}
                      formatter={(value, _name, _props, _i, payload) => {
                        const row = payload as
                          | (typeof avgChartData)[number]
                          | undefined;
                        const v = Number(value);
                        const vs = row ? formatWithSign(row.vsPar, 2) : "";
                        const plays = row ? ` · ${row.playCount} played` : "";
                        return `${v.toFixed(2)} avg (${vs} vs par)${plays}`;
                      }}
                    />
                  }
                />
                <ReferenceLine
                  y={overallAvgPar}
                  stroke="var(--muted-foreground)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg par ${overallAvgPar.toFixed(1)}`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="avgStrokes" radius={[4, 4, 0, 0]}>
                  {avgChartData.map((entry) => (
                    <Cell key={entry.hole} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-md justify-center mt-md text-meta text-muted-foreground">
              <LegendSwatch color="var(--success)" label="Under par" />
              <LegendSwatch color="var(--primary)" label="Near par" />
              <LegendSwatch color="var(--warning)" label="Bogey territory" />
              <LegendSwatch color="var(--destructive)" label="Double+ avg" />
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="distribution">
        <Card>
          <CardContent density="compact">
            <p className="text-body-sm text-muted-foreground mb-md">
              Scoring mix per hole as a share of rounds you&apos;ve played here.
              Hover to see exact percentages.
            </p>
            <ChartContainer
              className="h-80 w-full"
              config={{
                "Eagle+": { label: "Eagle or better", color: "var(--success)" },
                Birdie: { label: "Birdie", color: "var(--info)" },
                Par: { label: "Par", color: "var(--primary)" },
                Bogey: { label: "Bogey", color: "var(--warning)" },
                "Double+": {
                  label: "Double bogey or worse",
                  color: "var(--destructive)",
                },
              }}
            >
              <BarChart data={distChartData} accessibilityLayer stackOffset="expand">
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="hole"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${Math.round(value * 100)}%`}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      labelFormatter={(value) => `Hole ${value}`}
                      formatter={(value, name) =>
                        `${name}: ${Number(value).toFixed(0)}%`
                      }
                    />
                  }
                />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="square"
                />
                <Bar dataKey="Eagle+" stackId="a" fill="var(--color-Eagle+)" />
                <Bar dataKey="Birdie" stackId="a" fill="var(--color-Birdie)" />
                <Bar dataKey="Par" stackId="a" fill="var(--color-Par)" />
                <Bar dataKey="Bogey" stackId="a" fill="var(--color-Bogey)" />
                <Bar
                  dataKey="Double+"
                  stackId="a"
                  fill="var(--color-Double+)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-xs">
      <span
        aria-hidden
        className="inline-block w-3 h-3 rounded-sm"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

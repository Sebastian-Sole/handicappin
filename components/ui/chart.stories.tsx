import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "./chart";

const barData = [
  { month: "Jan", rounds: 2 },
  { month: "Feb", rounds: 3 },
  { month: "Mar", rounds: 5 },
  { month: "Apr", rounds: 8 },
  { month: "May", rounds: 12 },
  { month: "Jun", rounds: 9 },
];

const barConfig = {
  rounds: { label: "Rounds played", color: "var(--primary)" },
} satisfies ChartConfig;

const lineData = [
  { round: 1, handicap: 18.0 },
  { round: 2, handicap: 17.4 },
  { round: 3, handicap: 16.9 },
  { round: 4, handicap: 16.1 },
  { round: 5, handicap: 15.5 },
  { round: 6, handicap: 14.8 },
  { round: 7, handicap: 13.7 },
  { round: 8, handicap: 12.4 },
];

const lineConfig = {
  handicap: { label: "Handicap index", color: "var(--primary)" },
} satisfies ChartConfig;

const meta = {
  title: "UI/Chart",
  component: ChartContainer,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof ChartContainer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bars: Story = {
  args: {
    config: barConfig,
    className: "h-[280px] w-[520px]",
    children: (
      <BarChart data={barData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
        />
        <YAxis tickLine={false} axisLine={false} width={24} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="rounds" fill="var(--color-rounds)" radius={4} />
      </BarChart>
    ),
  },
};

export const LineSeries: Story = {
  args: {
    config: lineConfig,
    className: "h-[280px] w-[520px]",
    children: (
      <LineChart data={lineData}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="round"
          tickLine={false}
          tickMargin={8}
          axisLine={false}
        />
        <YAxis tickLine={false} axisLine={false} width={32} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="handicap"
          stroke="var(--color-handicap)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    ),
  },
};

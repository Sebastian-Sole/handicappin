import type { Meta, StoryObj } from "@storybook/nextjs";
import HandicapTrendChart from "./handicap-trend-chart";

const meta = {
  title: "Charts/HandicapTrendChart",
  component: HandicapTrendChart,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ width: 720, height: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof HandicapTrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

const fluctuating = [
  { key: "1", roundDate: "15-01-2025", roundTime: "10:00", handicap: 14.2 },
  { key: "2", roundDate: "22-01-2025", roundTime: "11:30", handicap: 13.8 },
  { key: "3", roundDate: "05-02-2025", roundTime: "09:15", handicap: 14.0 },
  { key: "4", roundDate: "19-02-2025", roundTime: "14:00", handicap: 13.5 },
  { key: "5", roundDate: "03-03-2025", roundTime: "08:45", handicap: 13.7 },
  { key: "6", roundDate: "17-03-2025", roundTime: "13:30", handicap: 13.1 },
  { key: "7", roundDate: "01-04-2025", roundTime: "10:00", handicap: 12.9 },
  { key: "8", roundDate: "15-04-2025", roundTime: "11:00", handicap: 12.7 },
  { key: "9", roundDate: "29-04-2025", roundTime: "10:30", handicap: 12.5 },
  { key: "10", roundDate: "13-05-2025", roundTime: "09:30", handicap: 12.4 },
];

const improving = [
  { key: "1", roundDate: "10-01-2025", roundTime: "10:00", handicap: 18.5 },
  { key: "2", roundDate: "24-01-2025", roundTime: "11:00", handicap: 17.6 },
  { key: "3", roundDate: "07-02-2025", roundTime: "09:30", handicap: 16.9 },
  { key: "4", roundDate: "21-02-2025", roundTime: "13:00", handicap: 15.8 },
  { key: "5", roundDate: "07-03-2025", roundTime: "10:30", handicap: 14.7 },
  { key: "6", roundDate: "21-03-2025", roundTime: "08:45", handicap: 13.9 },
  { key: "7", roundDate: "04-04-2025", roundTime: "11:30", handicap: 12.8 },
  { key: "8", roundDate: "18-04-2025", roundTime: "10:00", handicap: 12.1 },
];

const flat = [
  { key: "1", roundDate: "05-03-2025", roundTime: "10:00", handicap: 10.2 },
  { key: "2", roundDate: "12-03-2025", roundTime: "10:00", handicap: 10.3 },
  { key: "3", roundDate: "19-03-2025", roundTime: "10:00", handicap: 10.1 },
  { key: "4", roundDate: "26-03-2025", roundTime: "10:00", handicap: 10.2 },
  { key: "5", roundDate: "02-04-2025", roundTime: "10:00", handicap: 10.4 },
  { key: "6", roundDate: "09-04-2025", roundTime: "10:00", handicap: 10.3 },
  { key: "7", roundDate: "16-04-2025", roundTime: "10:00", handicap: 10.2 },
  { key: "8", roundDate: "23-04-2025", roundTime: "10:00", handicap: 10.2 },
];

export const Default: Story = {
  args: {
    previousHandicaps: fluctuating,
    isPositive: false,
  },
};

export const Improving: Story = {
  args: {
    previousHandicaps: improving,
    isPositive: false,
  },
};

export const Flat: Story = {
  args: {
    previousHandicaps: flat,
    isPositive: false,
  },
};

export const Regressing: Story = {
  args: {
    previousHandicaps: [...improving].reverse().map((h, i) => ({
      ...h,
      key: String(i + 1),
    })),
    isPositive: true,
  },
};

export const Empty: Story = {
  args: {
    previousHandicaps: [],
    isPositive: false,
  },
};

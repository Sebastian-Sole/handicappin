import type { Meta, StoryObj } from "@storybook/nextjs";
import DashboardGraphDisplay from "./dashboardGraphDisplay";

const meta = {
  title: "Dashboard/DashboardGraphDisplay",
  component: DashboardGraphDisplay,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof DashboardGraphDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

const graphData = [
  { key: "1", roundDate: "10-01-2025", roundTime: "10:00", score: 18.4, influencesHcp: true },
  { key: "2", roundDate: "24-01-2025", roundTime: "11:00", score: 16.1, influencesHcp: true },
  { key: "3", roundDate: "07-02-2025", roundTime: "09:30", score: 21.2, influencesHcp: false },
  { key: "4", roundDate: "21-02-2025", roundTime: "13:00", score: 15.8, influencesHcp: true },
  { key: "5", roundDate: "07-03-2025", roundTime: "10:30", score: 14.7, influencesHcp: true },
  { key: "6", roundDate: "21-03-2025", roundTime: "08:45", score: 19.3, influencesHcp: false },
  { key: "7", roundDate: "04-04-2025", roundTime: "11:30", score: 13.5, influencesHcp: true },
  { key: "8", roundDate: "18-04-2025", roundTime: "10:00", score: 12.9, influencesHcp: true },
  { key: "9", roundDate: "02-05-2025", roundTime: "10:00", score: 17.4, influencesHcp: false },
  { key: "10", roundDate: "16-05-2025", roundTime: "10:00", score: 12.1, influencesHcp: true },
];

export const Default: Story = {
  args: { graphData },
};

export const Sparse: Story = {
  args: { graphData: graphData.slice(0, 3) },
};

export const Empty: Story = {
  args: { graphData: [] },
};

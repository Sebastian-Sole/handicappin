import type { Meta, StoryObj } from "@storybook/nextjs";
import { QuickStats } from "./quick-stats";
import type { ActivityItem } from "@/utils/activity-transform";

const activities: ActivityItem[] = [
  {
    id: 110,
    date: new Date("2025-05-21T10:00:00.000Z"),
    courseName: "Cypress Point",
    score: 83,
    scoreDifferential: 12.1,
    handicapAfter: 12.4,
    handicapChange: -0.3,
    isPersonalBest: true,
    approvalStatus: "approved",
  },
  {
    id: 109,
    date: new Date("2025-05-07T10:00:00.000Z"),
    courseName: "Royal County Down",
    score: 89,
    scoreDifferential: 17.4,
    handicapAfter: 12.7,
    handicapChange: 0.1,
    isPersonalBest: false,
    approvalStatus: "approved",
  },
  {
    id: 108,
    date: new Date("2025-04-23T10:00:00.000Z"),
    courseName: "Carnoustie",
    score: 84,
    scoreDifferential: 12.9,
    handicapAfter: 12.6,
    handicapChange: -0.4,
    isPersonalBest: false,
    approvalStatus: "approved",
  },
  {
    id: 107,
    date: new Date("2025-04-09T11:30:00.000Z"),
    courseName: "St Andrews",
    score: 85,
    scoreDifferential: 13.5,
    handicapAfter: 13.0,
    handicapChange: -0.2,
    isPersonalBest: false,
    approvalStatus: "approved",
  },
  {
    id: 106,
    date: new Date("2025-03-26T08:45:00.000Z"),
    courseName: "Augusta National",
    score: 91,
    scoreDifferential: 19.3,
    handicapAfter: 13.2,
    handicapChange: 0.3,
    isPersonalBest: false,
    approvalStatus: "approved",
  },
];

const meta = {
  title: "Homepage/QuickStats",
  component: QuickStats,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof QuickStats>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    activities,
    lowestDifferential: 12.1,
    bestRoundDate: new Date("2025-05-21T10:00:00.000Z"),
  },
};

export const Improving: Story = {
  args: {
    activities: activities.map((a) => ({ ...a, handicapChange: -0.3 })),
    lowestDifferential: 12.1,
    bestRoundDate: new Date("2025-05-21T10:00:00.000Z"),
  },
};

export const Empty: Story = {
  args: {
    activities: [],
    lowestDifferential: null,
    bestRoundDate: null,
  },
};

import type { Meta, StoryObj } from "@storybook/nextjs";

import { CourseAnalyticsSection } from "./course-analytics-section";

const meta = {
  title: "Statistics/CourseAnalytics/CourseAnalyticsSection",
  component: CourseAnalyticsSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CourseAnalyticsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    courses: [
      {
        courseId: 1,
        courseName: "Pebble Beach Golf Links",
        city: "Pebble Beach",
        country: "US",
        roundCount: 6,
        avgDifferential: 9.6,
        bestDifferential: 4.1,
        worstDifferential: 14.2,
        avgScore: 84,
      },
      {
        courseId: 2,
        courseName: "St Andrews Old Course",
        city: "St Andrews",
        country: "GB",
        roundCount: 3,
        avgDifferential: 13.4,
        bestDifferential: 10.0,
        worstDifferential: 16.8,
        avgScore: 88,
      },
      {
        courseId: 3,
        courseName: "Augusta National",
        city: "Augusta",
        country: "US",
        roundCount: 2,
        avgDifferential: 16.7,
        bestDifferential: 13.2,
        worstDifferential: 20.1,
        avgScore: 91,
      },
      {
        courseId: 4,
        courseName: "Royal County Down",
        city: "Newcastle",
        country: "GB",
        roundCount: 1,
        avgDifferential: 18.9,
        bestDifferential: 18.9,
        worstDifferential: 18.9,
        avgScore: 93,
      },
    ],
  },
};

export const Empty: Story = {
  args: { courses: [] },
};

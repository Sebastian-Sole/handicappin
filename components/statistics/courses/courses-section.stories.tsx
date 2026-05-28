import type { Meta, StoryObj } from "@storybook/nextjs";

import { CoursesSection } from "./courses-section";

const meta = {
  title: "Statistics/Courses/CoursesSection",
  component: CoursesSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CoursesSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  args: {
    uniqueCourses: 5,
    totalRounds: 24,
    courses: [
      {
        courseId: 1,
        courseName: "Pebble Beach Golf Links",
        city: "Pebble Beach",
        country: "US",
        roundCount: 8,
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
        roundCount: 6,
        avgDifferential: 12.8,
        bestDifferential: 9.0,
        worstDifferential: 16.4,
        avgScore: 88,
      },
      {
        courseId: 3,
        courseName: "Cypress Point",
        city: "Pebble Beach",
        country: "US",
        roundCount: 4,
        avgDifferential: 14.2,
        bestDifferential: 10.0,
        worstDifferential: 19.1,
        avgScore: 90,
      },
      {
        courseId: 4,
        courseName: "Royal Melbourne",
        city: "Melbourne",
        country: "AU",
        roundCount: 5,
        avgDifferential: 11.7,
        bestDifferential: 8.4,
        worstDifferential: 15.2,
        avgScore: 87,
      },
      {
        courseId: 5,
        courseName: "Casa de Campo",
        city: "La Romana",
        country: "DO",
        roundCount: 1,
        avgDifferential: 19.8,
        bestDifferential: 19.8,
        worstDifferential: 19.8,
        avgScore: 94,
      },
    ],
  },
};

export const SingleCourse: Story = {
  args: {
    uniqueCourses: 1,
    totalRounds: 6,
    courses: [
      {
        courseId: 1,
        courseName: "Local Muni",
        city: "Oakland",
        country: "US",
        roundCount: 6,
        avgDifferential: 16.4,
        bestDifferential: 12.0,
        worstDifferential: 20.8,
        avgScore: 90,
      },
    ],
  },
};

export const Empty: Story = {
  args: {
    uniqueCourses: 0,
    totalRounds: 0,
    courses: [],
  },
};

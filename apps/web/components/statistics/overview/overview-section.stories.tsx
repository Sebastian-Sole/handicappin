import type { Meta, StoryObj } from "@storybook/nextjs";

import { PerformanceSection } from "./overview-section";

const meta = {
  title: "Statistics/Overview/PerformanceSection",
  component: PerformanceSection,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof PerformanceSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    stats: {
      totalRounds: 24,
      avgScore: 87.3,
      avgPar: 72,
      bestDifferential: 8.2,
      worstDifferential: 22.4,
      improvementRate: 12.5,
      currentHandicap: 12.4,
      handicapChange: -2.1,
    },
    shotLevelStats: {
      puttsPerRound: { value: 31.4, sampleSize: 12 },
      girPercentage: { value: 38.9, sampleSize: 12 },
      firPercentage: { value: 52.4, sampleSize: 11 },
      penaltiesPerRound: { value: 1.6, sampleSize: 12 },
    },
    extendedStats: {
      consistencyRating: 64,
      scoringConsistency: 4.2,
      bestMonth: {
        month: "April",
        year: 2026,
        avgDifferential: 9.8,
        roundCount: 5,
      },
      uniqueCourses: 7,
      exceptionalRounds: [
        {
          roundId: 101,
          courseName: "Pebble Beach Golf Links",
          country: "US",
          date: "2026-04-12",
          differential: 4.1,
          adjustment: 1.0,
        },
      ],
    },
    bestCourse: {
      courseId: 1,
      courseName: "Pebble Beach Golf Links",
      city: "Pebble Beach",
      country: "US",
      roundCount: 4,
      avgDifferential: 9.6,
      bestDifferential: 4.1,
      worstDifferential: 14.2,
      avgScore: 84,
    },
  },
};

export const NoExceptionalRounds: Story = {
  args: {
    stats: {
      totalRounds: 8,
      avgScore: 91.1,
      avgPar: 71,
      bestDifferential: 12.4,
      worstDifferential: 24.8,
      improvementRate: 4.2,
      currentHandicap: 18.7,
      handicapChange: -0.6,
    },
    shotLevelStats: {
      puttsPerRound: { value: 33.0, sampleSize: 2 },
      girPercentage: { value: 22.2, sampleSize: 2 },
      firPercentage: { value: null, sampleSize: 0 },
      penaltiesPerRound: { value: 2.5, sampleSize: 2 },
    },
    extendedStats: {
      consistencyRating: 38,
      scoringConsistency: 6.8,
      bestMonth: null,
      uniqueCourses: 3,
      exceptionalRounds: [],
    },
  },
};

/**
 * Exactly one detailed round — exercises basedOn()'s singular
 * "Based on 1 round" wording branch (sampleSize === 1).
 */
export const SingleDetailedRound: Story = {
  args: {
    stats: {
      totalRounds: 3,
      avgScore: 89.7,
      avgPar: 72,
      bestDifferential: 14.1,
      worstDifferential: 19.3,
      improvementRate: 0,
      currentHandicap: 16.2,
      handicapChange: 0.3,
    },
    shotLevelStats: {
      puttsPerRound: { value: 34, sampleSize: 1 },
      girPercentage: { value: 27.8, sampleSize: 1 },
      firPercentage: { value: 42.9, sampleSize: 1 },
      penaltiesPerRound: { value: 3, sampleSize: 1 },
    },
    extendedStats: {
      consistencyRating: 41,
      scoringConsistency: 5.9,
      bestMonth: null,
      uniqueCourses: 2,
      exceptionalRounds: [],
    },
  },
};

export const EmptyState: Story = {
  args: {
    stats: {
      totalRounds: 0,
      avgScore: 0,
      avgPar: null,
      bestDifferential: 0,
      worstDifferential: 0,
      improvementRate: 0,
      currentHandicap: 0,
      handicapChange: 0,
    },
    shotLevelStats: {
      puttsPerRound: { value: null, sampleSize: 0 },
      girPercentage: { value: null, sampleSize: 0 },
      firPercentage: { value: null, sampleSize: 0 },
      penaltiesPerRound: { value: null, sampleSize: 0 },
    },
    extendedStats: {
      consistencyRating: 0,
      scoringConsistency: 0,
      bestMonth: null,
      uniqueCourses: 0,
      exceptionalRounds: [],
    },
  },
};

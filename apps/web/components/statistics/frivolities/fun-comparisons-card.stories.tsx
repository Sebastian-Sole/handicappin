import type { Meta, StoryObj } from "@storybook/nextjs";

import { FunComparisonsCard } from "./fun-comparisons-card";

const meta = {
  title: "Statistics/Frivolities/FunComparisonsCard",
  component: FunComparisonsCard,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof FunComparisonsCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    totalStrokes: 8432,
    totalHoles: 432,
    golfAgeDays: 410,
    totalDistancePlayed: 102000,
    uniqueCourses: 7,
  },
};

export const Veteran: Story = {
  args: {
    totalStrokes: 52000,
    totalHoles: 2400,
    golfAgeDays: 3650,
    totalDistancePlayed: 612000,
    uniqueCourses: 28,
  },
};

export const FewRounds: Story = {
  args: {
    totalStrokes: 280,
    totalHoles: 36,
    golfAgeDays: 45,
    totalDistancePlayed: 8200,
    uniqueCourses: 1,
  },
};

export const NoData: Story = {
  args: {
    totalStrokes: 0,
    totalHoles: 0,
    golfAgeDays: 0,
  },
};

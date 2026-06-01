import type { Meta, StoryObj } from "@storybook/nextjs";

import { CourseHoleTabs, type HoleStat } from "./course-hole-tabs";

const meta = {
  title: "Statistics/Courses/CourseHoleTabs",
  component: CourseHoleTabs,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof CourseHoleTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

const buildHole = (
  holeNumber: number,
  par: number,
  avgStrokes: number,
  playCount: number,
): HoleStat => ({
  holeNumber,
  par,
  playCount,
  avgStrokes,
  avgVsPar: avgStrokes - par,
  best: Math.max(2, par - 1),
  worst: par + 3,
  distribution: {
    eagleOrBetter: 0,
    birdie: Math.max(0, Math.round(playCount * 0.1)),
    par: Math.round(playCount * 0.35),
    bogey: Math.round(playCount * 0.4),
    doubleOrWorse: Math.max(0, Math.round(playCount * 0.15)),
  },
});

const eighteenHoles: HoleStat[] = [
  buildHole(1, 4, 4.6, 8),
  buildHole(2, 5, 5.8, 8),
  buildHole(3, 3, 3.4, 8),
  buildHole(4, 4, 4.9, 8),
  buildHole(5, 4, 4.5, 8),
  buildHole(6, 5, 5.6, 8),
  buildHole(7, 3, 3.8, 8),
  buildHole(8, 4, 4.7, 8),
  buildHole(9, 4, 5.0, 8),
  buildHole(10, 4, 4.4, 7),
  buildHole(11, 4, 4.8, 7),
  buildHole(12, 3, 3.6, 7),
  buildHole(13, 5, 5.9, 7),
  buildHole(14, 4, 4.7, 7),
  buildHole(15, 4, 4.5, 7),
  buildHole(16, 3, 3.7, 7),
  buildHole(17, 4, 5.1, 7),
  buildHole(18, 5, 6.0, 7),
];

const nineHoles: HoleStat[] = eighteenHoles.slice(0, 9);

export const EighteenHoles: Story = {
  args: { holes: eighteenHoles },
};

export const NineHoles: Story = {
  args: { holes: nineHoles },
};

export const Empty: Story = {
  args: { holes: [] },
};

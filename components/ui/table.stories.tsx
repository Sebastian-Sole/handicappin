import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

const rounds = [
  { id: "r1", date: "2024-08-12", course: "Pine Ridge GC", score: 82, diff: 9.2 },
  { id: "r2", date: "2024-08-05", course: "Oakmont Public", score: 88, diff: 13.7 },
  { id: "r3", date: "2024-07-28", course: "Pine Ridge GC", score: 79, diff: 7.0 },
  { id: "r4", date: "2024-07-20", course: "River Bend", score: 85, diff: 11.4 },
];

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>Most recent rounds (last 4 weeks)</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Course</TableHead>
          <TableHead className="text-right">Score</TableHead>
          <TableHead className="text-right">Differential</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rounds.map((r) => (
          <TableRow key={r.id}>
            <TableCell>{r.date}</TableCell>
            <TableCell>{r.course}</TableCell>
            <TableCell className="text-right">{r.score}</TableCell>
            <TableCell className="text-right">{r.diff.toFixed(1)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={2}>Average</TableCell>
          <TableCell className="text-right">
            {Math.round(rounds.reduce((s, r) => s + r.score, 0) / rounds.length)}
          </TableCell>
          <TableCell className="text-right">
            {(rounds.reduce((s, r) => s + r.diff, 0) / rounds.length).toFixed(1)}
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};

export const Empty: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Course</TableHead>
          <TableHead>Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell colSpan={3} className="text-center text-muted-foreground">
            No rounds logged yet.
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};

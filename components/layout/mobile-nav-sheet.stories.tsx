import type { Meta, StoryObj } from "@storybook/nextjs";
import { Button } from "@/components/ui/button";

import { MobileNavSheet } from "./mobile-nav-sheet";

const meta = {
  title: "Layout/MobileNavSheet",
  component: MobileNavSheet,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof MobileNavSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleLinks = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/calculators", label: "Calculators" },
  { href: "/contact", label: "Contact" },
];

export const Default: Story = {
  args: {
    links: sampleLinks,
  },
};

export const WithHeaderAndChildren: Story = {
  args: {
    links: sampleLinks,
    headerContent: (
      <div className="text-label-sm font-medium">storybook@example.com</div>
    ),
    children: (
      <Button variant="outline" className="w-full">
        Sign out
      </Button>
    ),
  },
};

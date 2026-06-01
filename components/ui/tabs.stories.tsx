import type { Meta, StoryObj } from "@storybook/nextjs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  title: "UI/Tabs",
  component: Tabs,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ThreeTabs: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[420px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="rounds">Rounds</TabsTrigger>
        <TabsTrigger value="stats">Stats</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-body-sm">Summary of your handicap journey.</p>
      </TabsContent>
      <TabsContent value="rounds">
        <p className="text-body-sm">Your recent rounds will show here.</p>
      </TabsContent>
      <TabsContent value="stats">
        <p className="text-body-sm">Statistics breakdown.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const TwoTabs: Story = {
  render: () => (
    <Tabs defaultValue="signin" className="w-[360px]">
      <TabsList>
        <TabsTrigger value="signin">Sign in</TabsTrigger>
        <TabsTrigger value="signup">Sign up</TabsTrigger>
      </TabsList>
      <TabsContent value="signin">
        <p className="text-body-sm">Sign-in form goes here.</p>
      </TabsContent>
      <TabsContent value="signup">
        <p className="text-body-sm">Sign-up form goes here.</p>
      </TabsContent>
    </Tabs>
  ),
};

export const FourTabs: Story = {
  render: () => (
    <Tabs defaultValue="a" className="w-[480px]">
      <TabsList>
        <TabsTrigger value="a">All</TabsTrigger>
        <TabsTrigger value="b">Best</TabsTrigger>
        <TabsTrigger value="c">Worst</TabsTrigger>
        <TabsTrigger value="d">Recent</TabsTrigger>
      </TabsList>
      <TabsContent value="a">All rounds</TabsContent>
      <TabsContent value="b">Best rounds</TabsContent>
      <TabsContent value="c">Worst rounds</TabsContent>
      <TabsContent value="d">Recent rounds</TabsContent>
    </Tabs>
  ),
};

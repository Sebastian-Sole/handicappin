import type { Meta, StoryObj } from "@storybook/nextjs";
import {
  Blockquote,
  H1,
  H2,
  H3,
  H4,
  InlineCode,
  Large,
  Lead,
  Muted,
  P,
  Small,
} from "./typography";

const meta = {
  title: "UI/Typography",
  component: H1,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof H1>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Headings: Story = {
  args: { children: "" },
  render: () => (
    <div className="space-y-md">
      <H1>Heading one</H1>
      <H2>Heading two</H2>
      <H3>Heading three</H3>
      <H4>Heading four</H4>
    </div>
  ),
};

export const BodyAndLead: Story = {
  args: { children: "" },
  render: () => (
    <div className="max-w-prose space-y-md">
      <Lead>
        A lead paragraph that introduces the section with a slightly larger,
        muted treatment.
      </Lead>
      <P>
        This is a body paragraph. It uses the body typography token with a
        comfortable measure and a top margin between paragraphs.
      </P>
      <P>
        A second paragraph showing the not-first margin behavior. Body copy
        should sit comfortably under headings without manual adjustment.
      </P>
    </div>
  ),
};

export const InlineVariants: Story = {
  args: { children: "" },
  render: () => (
    <div className="space-y-md max-w-prose">
      <p>
        You can highlight a value with <Large>important text</Large> inline,
        or call out a token like <InlineCode>--color-primary</InlineCode>.
      </p>
      <Small>Small caption text.</Small>
      <Muted>Muted helper text for de-emphasized content.</Muted>
    </div>
  ),
};

export const Blockquoted: Story = {
  args: { children: "" },
  render: () => (
    <Blockquote>
      &ldquo;The handicap system is designed to enable as many people as
      possible to compete on a fair basis.&rdquo;
    </Blockquote>
  ),
};

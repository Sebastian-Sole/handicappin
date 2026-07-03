/**
 * payment-failed email template render tests (plan 005, Step 2 verification).
 *
 * The `pnpm email` preview server can't run headless in CI, so this render
 * test is the gate: the template must render real HTML in BOTH
 * isFinalAttempt states, and must uphold the data-minimization rule (no
 * amounts, card details, or invoice IDs are even accepted as props — this
 * asserts the copy that IS expected).
 */
import { describe, it, expect } from "vitest";
import { render } from "@react-email/components";
import PaymentFailedEmail from "@/emails/payment-failed";

const baseProps = {
  name: "Sebastian",
  plan: "premium",
  billingUrl: "https://handicappin.com/billing",
  supportEmail: "support@handicappin.test",
};

describe("PaymentFailedEmail template", () => {
  it("renders the retry copy when isFinalAttempt is false", async () => {
    const html = await render(
      PaymentFailedEmail({ ...baseProps, isFinalAttempt: false }),
    );

    expect(html).toContain("Payment Failed");
    expect(html).toContain("automatically retry");
    expect(html).toContain("https://handicappin.com/billing");
    expect(html).toContain("Premium");
    expect(html).not.toContain("final retry");
  });

  it("renders the final-attempt copy when isFinalAttempt is true", async () => {
    const html = await render(
      PaymentFailedEmail({ ...baseProps, isFinalAttempt: true }),
    );

    expect(html).toContain("Payment Failed");
    expect(html).toContain("final retry attempt");
    expect(html).toContain("will be cancelled");
    expect(html).toContain("https://handicappin.com/billing");
  });

  it("renders without a name and with a null plan (fallback copy)", async () => {
    const html = await render(
      PaymentFailedEmail({
        name: null,
        plan: null,
        billingUrl: "https://handicappin.com/billing",
        isFinalAttempt: false,
        supportEmail: "support@handicappin.test",
      }),
    );

    expect(html).toContain("Payment Failed");
    expect(html).toContain("subscription");
  });
});

/**
 * Admin Router Input Validation (plans/003-rejection-loop)
 *
 * `rejectSubmissionInput` gained a required `reason` field so rejections
 * always carry a reason the user can see (mirrors the `p_reason` guard in
 * `reject_submission`, supabase/migrations/20260703091818). These tests
 * cover the zod schema in isolation — no database, no tRPC context.
 */
import { describe, it, expect } from "vitest";
import {
  approveSubmissionInput,
  rejectSubmissionInput,
} from "@/server/api/routers/admin";

describe("Admin Router Input Validation", () => {
  describe("approveSubmissionInput", () => {
    it("accepts a positive integer submissionId", () => {
      const result = approveSubmissionInput.safeParse({ submissionId: 1 });
      expect(result.success).toBe(true);
    });

    it("rejects a non-positive submissionId", () => {
      const result = approveSubmissionInput.safeParse({ submissionId: 0 });
      expect(result.success).toBe(false);
    });

    it("rejects a non-integer submissionId", () => {
      const result = approveSubmissionInput.safeParse({ submissionId: 1.5 });
      expect(result.success).toBe(false);
    });
  });

  describe("rejectSubmissionInput", () => {
    it("accepts a submissionId with a reason of at least 3 characters", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: 1,
        reason: "Bad data",
      });
      expect(result.success).toBe(true);
    });

    it("trims the reason", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: 1,
        reason: "  Bad data  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.reason).toBe("Bad data");
      }
    });

    it("rejects a missing reason", () => {
      const result = rejectSubmissionInput.safeParse({ submissionId: 1 });
      expect(result.success).toBe(false);
    });

    it("rejects an empty reason", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: 1,
        reason: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a reason that trims below the 3-character minimum", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: 1,
        reason: "  a  ",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a reason over 1000 characters", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: 1,
        reason: "a".repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it("accepts a reason at exactly the 1000-character maximum", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: 1,
        reason: "a".repeat(1000),
      });
      expect(result.success).toBe(true);
    });

    it("rejects a non-positive submissionId", () => {
      const result = rejectSubmissionInput.safeParse({
        submissionId: -1,
        reason: "Bad data",
      });
      expect(result.success).toBe(false);
    });
  });
});

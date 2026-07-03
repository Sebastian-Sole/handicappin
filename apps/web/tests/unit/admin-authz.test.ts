import { describe, test, expect } from "vitest";
import { isAdminEmail } from "@/lib/admin-authz";

describe("isAdminEmail", () => {
  test("allows an email present in the allowlist", () => {
    expect(isAdminEmail("admin@handicappin.com", "admin@handicappin.com")).toBe(
      true
    );
  });

  test("allows an email present among multiple comma-separated entries", () => {
    const allowlist = "founder@handicappin.com,admin@handicappin.com";
    expect(isAdminEmail("admin@handicappin.com", allowlist)).toBe(true);
    expect(isAdminEmail("founder@handicappin.com", allowlist)).toBe(true);
  });

  test("matches case-insensitively", () => {
    expect(isAdminEmail("Admin@Handicappin.com", "admin@handicappin.com")).toBe(
      true
    );
    expect(isAdminEmail("admin@handicappin.com", "ADMIN@HANDICAPPIN.COM")).toBe(
      true
    );
  });

  test("tolerates whitespace around entries in the env var", () => {
    const allowlist = " admin@handicappin.com , founder@handicappin.com ";
    expect(isAdminEmail("admin@handicappin.com", allowlist)).toBe(true);
    expect(isAdminEmail("founder@handicappin.com", allowlist)).toBe(true);
  });

  test("denies an email not present in the allowlist", () => {
    expect(isAdminEmail("nobody@example.com", "admin@handicappin.com")).toBe(
      false
    );
  });

  test("denies everyone when the allowlist is empty", () => {
    expect(isAdminEmail("admin@handicappin.com", "")).toBe(false);
  });

  test("denies everyone when the allowlist only contains blank entries", () => {
    expect(isAdminEmail("admin@handicappin.com", " , , ")).toBe(false);
  });

  test("denies a null email", () => {
    expect(isAdminEmail(null, "admin@handicappin.com")).toBe(false);
  });

  test("denies an undefined email", () => {
    expect(isAdminEmail(undefined, "admin@handicappin.com")).toBe(false);
  });

  test("denies an empty-string email", () => {
    expect(isAdminEmail("", "admin@handicappin.com")).toBe(false);
  });
});

/**
 * Reporter for `pnpm test:integration` (wired in
 * `vitest.config.integration.ts`) that states, per run, how many test FILES
 * actually executed versus skipped everything.
 *
 * Vitest's default summary counts tests, which buries the failure mode this
 * suite has: a file whose `describeIfLocal` guard resolved to
 * `describe.skip` contributes only "skipped" tests and is easy to misread as
 * coverage. This reporter names each fully-skipped file so a green run can
 * never quietly mean "nothing ran".
 */
import type { Reporter, TestModule } from "vitest/node";

export class IntegrationSummaryReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>): void {
    const executed: string[] = [];
    const fullySkipped: string[] = [];

    for (const testModule of testModules) {
      const tests = [...testModule.children.allTests()];
      const ranAny = tests.some((test) => {
        const state = test.result().state;
        return state === "passed" || state === "failed";
      });
      const shortName =
        testModule.moduleId.split("/tests/integration/").pop() ??
        testModule.moduleId;
      (ranAny ? executed : fullySkipped).push(shortName);
    }

    const total = executed.length + fullySkipped.length;
    const lines = [
      "",
      `[integration summary] ${executed.length} of ${total} test files executed at least one test; ${fullySkipped.length} fully skipped.`,
    ];
    if (fullySkipped.length > 0) {
      lines.push(
        `[integration summary] fully-skipped files: ${fullySkipped.join(", ")}`
      );
    }
    console.log(lines.join("\n"));
  }
}

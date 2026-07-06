import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

type TraceFixtureCatalogSummaryOutput = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  failedItems: unknown[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};

describe("trace fixture catalog report script", () => {
  it("prints parseable catalog health JSON for committed governed fixtures", () => {
    const result = spawnSync("npm", ["run", "trace:fixtures", "--silent"], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    expect(result.status).toBe(0);
    expect(result.stderr.trim()).toBe("");

    const output = JSON.parse(result.stdout) as TraceFixtureCatalogSummaryOutput;
    expect(output).toMatchObject({
      ok: true,
      total: 2,
      passed: 2,
      failed: 0,
      fixtureIds: ["sales-pipeline-governed", "support-resolution-governed"],
      playbookIds: ["sales-pipeline-v1", "support-resolution-v1"],
      failedItems: [],
      guarantees: {
        toolCallsExecuted: false,
        assetsWritten: false,
      },
    });
  });
});

import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_REVIEW_COMMAND,
  buildPlaybookLifecycleReviewCliResult,
  parsePlaybookLifecycleReviewArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-review.mjs";

describe("playbook lifecycle review script", () => {
  it("parses default arguments", () => {
    expect(parsePlaybookLifecycleReviewArgs([])).toEqual({
      pretty: true,
      now: undefined,
    });
  });

  it("supports compact output and deterministic date input", () => {
    expect(parsePlaybookLifecycleReviewArgs(["--compact", "--now", "2027-01-03"])).toEqual({
      pretty: false,
      now: "2027-01-03",
    });
  });

  it("rejects unknown arguments", () => {
    expect(() => parsePlaybookLifecycleReviewArgs(["--bad"])).toThrow("Unknown option: --bad");
  });

  it("builds a deterministic due-review CLI result", () => {
    const result = buildPlaybookLifecycleReviewCliResult({
      pretty: false,
      now: "2027-01-03",
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      command: PLAYBOOK_LIFECYCLE_REVIEW_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      diagnosticOnly: true,
      summary: {
        playbooks: 2,
        activePlaybooks: 2,
        due: 2,
        overdue: 0,
        findings: 2,
      },
    });
  });
});

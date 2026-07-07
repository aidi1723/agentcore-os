import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND,
  buildPlaybookLifecycleHandoffCliResult,
  parsePlaybookLifecycleHandoffArgs,
} from "../../../scripts/playbooks/check-playbook-lifecycle-handoff.mjs";

describe("playbook lifecycle handoff script", () => {
  it("parses default arguments", () => {
    expect(parsePlaybookLifecycleHandoffArgs([])).toEqual({
      pretty: true,
      now: undefined,
    });
  });

  it("supports compact output and deterministic date input", () => {
    expect(parsePlaybookLifecycleHandoffArgs(["--compact", "--now", "2027-01-03"])).toEqual({
      pretty: false,
      now: "2027-01-03",
    });
  });

  it("rejects unknown arguments", () => {
    expect(() => parsePlaybookLifecycleHandoffArgs(["--bad"])).toThrow("Unknown option: --bad");
  });

  it("builds a successful CLI result for the current registered catalog", () => {
    const result = buildPlaybookLifecycleHandoffCliResult({
      pretty: false,
      now: "2026-07-07",
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      readyForLifecycleHandoff: true,
      command: PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      handoffOnly: true,
      summary: {
        playbooks: 2,
        activePlaybooks: 2,
        deprecatedPlaybooks: 0,
        findings: 0,
      },
    });
  });

  it("builds a deterministic due-review failure result", () => {
    const result = buildPlaybookLifecycleHandoffCliResult({
      pretty: false,
      now: "2027-01-03",
    });

    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      readyForLifecycleHandoff: false,
      command: PLAYBOOK_LIFECYCLE_HANDOFF_COMMAND,
      summary: {
        lifecycleReviewFindings: 2,
        findings: 1,
      },
      findings: [
        {
          code: "lifecycle_review_not_green",
          severity: "error",
          count: 2,
        },
      ],
    });
  });
});

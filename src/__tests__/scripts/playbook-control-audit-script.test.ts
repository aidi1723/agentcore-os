import { describe, expect, it } from "vitest";

import {
  PLAYBOOK_CONTROL_AUDIT_COMMAND,
  buildPlaybookControlAuditCliResult,
  parsePlaybookControlAuditArgs,
} from "../../../scripts/playbooks/check-playbook-control.mjs";

describe("playbook control audit script", () => {
  it("parses default arguments", () => {
    expect(parsePlaybookControlAuditArgs([])).toEqual({
      pretty: true,
    });
  });

  it("supports compact JSON output", () => {
    expect(parsePlaybookControlAuditArgs(["--compact"])).toEqual({
      pretty: false,
    });
  });

  it("rejects unknown arguments", () => {
    expect(() => parsePlaybookControlAuditArgs(["--bad"])).toThrow("Unknown option: --bad");
  });

  it("builds a successful CLI result for the current registered catalog", () => {
    const result = buildPlaybookControlAuditCliResult({
      pretty: false,
    });

    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: true,
      command: PLAYBOOK_CONTROL_AUDIT_COMMAND,
      productionReady: false,
      publishingPerformed: false,
      auditOnly: true,
      summary: {
        playbooks: 2,
        fixtures: 2,
        findings: 0,
      },
      findings: [],
    });
  });
});

import type { ControlledTraceFixture } from "./trace-fixtures";
import { validateControlledTraceFixture } from "./trace-fixtures";
import {
  type ReplayApprovalMode,
  type ReplaySandboxContract,
  validateReplaySandboxContract,
} from "./replay-sandbox-contracts";

export type ReplaySandboxContractBuildResult =
  | {
      ok: true;
      errors: [];
      contract: ReplaySandboxContract;
    }
  | {
      ok: false;
      errors: string[];
    };

type BuildReplaySandboxContractFromFixtureOptions = {
  replayId?: string;
  sandboxId?: string;
};

function deriveApprovalDecisions(fixture: ControlledTraceFixture) {
  return fixture.steps.flatMap((step) => {
    if (step.approvalState === "approved" || step.approvalState === "rejected") {
      return [
        {
          stepId: step.stepId,
          decision: step.approvalState,
        },
      ];
    }
    return [];
  });
}

function validateFixtureContractInput(fixture: ControlledTraceFixture) {
  const errors = validateControlledTraceFixture(fixture).errors;

  if (!fixture.fixtureId) errors.push("Fixture fixtureId is required");
  if (!fixture.sourceRunId) errors.push("Fixture sourceRunId is required");
  if (!fixture.playbookId) errors.push("Fixture playbookId is required");
  if (!fixture.playbookVersion) errors.push("Fixture playbookVersion is required");
  if (!fixture.scenarioId) errors.push("Fixture scenarioId is required");
  if (typeof fixture.generatedAt !== "number") {
    errors.push("Fixture generatedAt must be a number");
  }
  if (fixture.governance.mode !== "fixture" && fixture.governance.mode !== "audit") {
    errors.push(`Fixture governance mode ${fixture.governance.mode} is not allowed`);
  }
  if (fixture.assertions.redactionBoundary !== "required") {
    errors.push("Fixture redaction boundary is required");
  }

  return errors;
}

export function buildReplaySandboxContractFromFixture(
  fixture: ControlledTraceFixture,
  options: BuildReplaySandboxContractFromFixtureOptions = {},
): ReplaySandboxContractBuildResult {
  const inputErrors = validateFixtureContractInput(fixture);
  const contract: ReplaySandboxContract = {
    replayId: options.replayId ?? `replay:${fixture.fixtureId}`,
    sandboxId: options.sandboxId ?? `sandbox:${fixture.fixtureId}`,
    mode: "no_side_effect_prototype",
    input: {
      kind: "committed_fixture",
      sourceId: fixture.fixtureId,
      playbookId: fixture.playbookId,
      playbookVersion: fixture.playbookVersion,
      scenarioId: fixture.scenarioId ?? "",
      generatedAt: fixture.generatedAt,
      governanceMode: fixture.governance.mode,
      redactionBoundary: fixture.assertions.redactionBoundary,
    },
    credentialPolicy: {
      mode: "fixture",
    },
    approvalPolicy: {
      mode: "fixture_derived" satisfies ReplayApprovalMode,
      simulatedDecisions: deriveApprovalDecisions(fixture),
    },
    storePolicy: {
      mode: "fixture_only",
      requestedStores: [],
    },
    sideEffectPolicy: {
      allowedOutput: "replay_result_artifact",
      blocked: [],
    },
  };
  const contractValidation = validateReplaySandboxContract(contract);
  const errors = Array.from(new Set([...inputErrors, ...contractValidation.errors]));

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
    };
  }

  return {
    ok: true,
    errors: [],
    contract,
  };
}

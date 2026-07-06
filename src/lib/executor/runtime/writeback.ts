import type { StepResult } from "@/lib/executor/contracts";
import { getControlledPlaybook } from "@/lib/executor/playbooks/catalog";
import type { ControlledPlaybookStep } from "@/lib/executor/playbooks/types";
import type {
  ControlledExecutionRunRecord,
  ControlledWritebackReceipt,
} from "@/lib/executor/runtime/types";
import { upsertDraftInStore } from "@/lib/server/draft-store";
import { upsertKnowledgeAssetInStore } from "@/lib/server/knowledge-asset-store";
import { upsertSalesAssetInStore } from "@/lib/server/sales-asset-store";
import { upsertWorkflowRunInStore } from "@/lib/server/workflow-run-store";

type WriteControlledStepAssetsInput = {
  run: ControlledExecutionRunRecord;
  step: ControlledPlaybookStep | null;
  result: StepResult;
  previousResults: StepResult[];
  approved: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

function outputFor(results: StepResult[], stepId: string) {
  const match = [...results].reverse().find((result) => result.stepId === stepId);
  return isRecord(match?.output) ? match.output : {};
}

function workflowRunIdFor(run: ControlledExecutionRunRecord) {
  return run.workflowRunId?.trim() || run.id;
}

function scenarioIdFor(run: ControlledExecutionRunRecord) {
  return run.scenarioId?.trim() || "sales-pipeline";
}

function stableId(prefix: string, key: string) {
  return `${prefix}:${key.replace(/[^a-zA-Z0-9._:-]/g, "_")}`;
}

function buildSalesAssetInput(input: WriteControlledStepAssetsInput) {
  const allResults = [...input.previousResults, input.result];
  const intake = outputFor(allResults, "intake");
  const normalizedLead = isRecord(intake.normalizedLead) ? intake.normalizedLead : {};
  const qualify = outputFor(allResults, "qualify");
  const draft = outputFor(allResults, "draft_outreach");
  const review = outputFor(allResults, "human_review");
  const workflowRunId = workflowRunIdFor(input.run);
  const approvedBody =
    stringValue(review.approvedBody) ||
    stringValue(isRecord(input.result.output) ? input.result.output.knowledgeAssetCandidate : "") ||
    stringValue(draft.body);
  const reviewNotes = stringValue(review.reviewNotes);
  const now = Date.now();

  return {
    id: stableId("controlled-sales-asset", workflowRunId),
    workflowRunId,
    scenarioId: scenarioIdFor(input.run),
    company: stringValue(normalizedLead.company),
    contactName: stringValue(normalizedLead.contact),
    inquiryChannel: stringValue(normalizedLead.inquiryChannel),
    preferredLanguage: stringValue(normalizedLead.preferredLanguage),
    productLine: stringValue(normalizedLead.productLine),
    requirementSummary:
      stringValue(intake.summary) || stringValue(normalizedLead.need) || approvedBody,
    preferenceNotes: stringList(qualify.reasons).join("\n"),
    objectionNotes: stringList(qualify.risks).join("\n"),
    nextAction: stringValue(qualify.nextAction),
    quoteNotes: "",
    quoteStatus: "not_started",
    latestDraftSubject: stringValue(draft.subject),
    latestDraftBody: approvedBody,
    assetDraft: [approvedBody, reviewNotes].filter(Boolean).join("\n\nReview notes: "),
    status: input.step?.id === "writeback" ? "completed" : "qualifying",
    createdAt: now,
    updatedAt: now,
  };
}

function buildKnowledgeAssetInput(input: WriteControlledStepAssetsInput) {
  const allResults = [...input.previousResults, input.result];
  const intake = outputFor(allResults, "intake");
  const normalizedLead = isRecord(intake.normalizedLead) ? intake.normalizedLead : {};
  const qualify = outputFor(allResults, "qualify");
  const review = outputFor(allResults, "human_review");
  const workflowRunId = workflowRunIdFor(input.run);
  const sourceKey = `controlled-run:${input.run.id}:knowledge_asset`;
  const approvedBody =
    stringValue(review.approvedBody) ||
    stringValue(isRecord(input.result.output) ? input.result.output.knowledgeAssetCandidate : "");
  const reviewNotes = stringValue(review.reviewNotes);
  const rationale = stringList(qualify.reasons);
  const risks = stringList(qualify.risks);
  const company = stringValue(normalizedLead.company);
  const now = Date.now();

  return {
    id: stableId("controlled-knowledge-asset", input.run.id),
    sourceKey,
    title: `Sales playbook asset - ${company || input.run.id}`,
    body: [
      approvedBody,
      reviewNotes ? `Review notes: ${reviewNotes}` : "",
      rationale.length ? `Qualification rationale: ${rationale.join("; ")}` : "",
      risks.length ? `Risks: ${risks.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
    sourceApp: "personal_crm",
    scenarioId: scenarioIdFor(input.run),
    workflowRunId,
    assetType: "sales_playbook",
    status: "active",
    tags: ["controlled-run", "sales-pipeline", input.run.playbookId],
    applicableScene: "sales-pipeline approved outreach and follow-up",
    reuseCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function buildWorkflowRunInput(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const workflowRunId = workflowRunIdFor(input.run);
  const scenarioId = scenarioIdFor(input.run);
  const playbook = getControlledPlaybook(input.run.playbookId);
  const planSteps = playbook?.steps ?? input.run.plan.steps;
  const currentStepIndex = planSteps.findIndex((step) => step.id === input.result.stepId);
  const normalizedIndex = currentStepIndex >= 0 ? currentStepIndex : 0;
  const isFinalWriteback = input.result.stepId === "writeback" && input.approved;
  const nextStep = planSteps[normalizedIndex + 1];
  const stageRuns = planSteps.map((step, index) => {
    const state =
      isFinalWriteback || index <= normalizedIndex
        ? "completed"
        : index === normalizedIndex + 1
          ? step.mode === "review" || step.mode === "manual"
            ? "awaiting_human"
            : "running"
          : "pending";
    return {
      id: step.id,
      title: step.title,
      mode: step.mode,
      state,
    };
  });

  return {
    id: workflowRunId,
    scenarioId,
    scenarioTitle: playbook?.title ?? input.run.plan.goal ?? input.run.playbookId,
    triggerType: "manual",
    state: isFinalWriteback
      ? "completed"
      : nextStep?.mode === "review" || nextStep?.mode === "manual"
        ? "awaiting_human"
        : "running",
    currentStageId: isFinalWriteback ? undefined : nextStep?.id ?? input.result.stepId,
    stageRuns,
    createdAt: input.run.createdAt,
    updatedAt: writtenAt,
  };
}

function buildDraftInput(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const allResults = [...input.previousResults, input.result];
  const intake = outputFor(allResults, "intake");
  const normalizedLead = isRecord(intake.normalizedLead) ? intake.normalizedLead : {};
  const qualify = outputFor(allResults, "qualify");
  const draft = outputFor(allResults, "draft_outreach");
  const workflowRunId = workflowRunIdFor(input.run);
  const company = stringValue(normalizedLead.company);
  const contact = stringValue(normalizedLead.contact);
  const assumptions = stringList(draft.assumptions);
  const needsHumanCheck = stringList(draft.needsHumanCheck);

  return {
    id: stableId("controlled-draft", workflowRunId),
    title: stringValue(draft.subject) || `Sales outreach draft - ${company || workflowRunId}`,
    body: stringValue(draft.body),
    tags: ["controlled-run", "sales-pipeline", input.run.playbookId],
    source: "publisher",
    workflowRunId,
    workflowScenarioId: scenarioIdFor(input.run),
    workflowStageId: "draft_outreach",
    workflowSource: `Controlled run ${input.run.id}`,
    workflowNextStep: "Review and approve the controlled outreach draft.",
    workflowTriggerType: "manual",
    workflowOriginApp: "publisher",
    workflowOriginId: input.run.id,
    workflowOriginLabel: input.run.playbookId,
    workflowAudience: [company, contact].filter(Boolean).join(" / ") || undefined,
    workflowPrimaryAngle: stringValue(qualify.nextAction) || undefined,
    workflowSourceSummary: stringValue(intake.summary) || undefined,
    workflowBlockLabel: "Controlled Runtime",
    workflowPublishNotes: [...assumptions, ...needsHumanCheck].join("\n") || undefined,
    createdAt: input.run.createdAt,
    updatedAt: writtenAt,
  };
}

async function writeWorkflowRun(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildWorkflowRunInput(input, writtenAt);
  const result = await upsertWorkflowRunInStore(payload);
  const stored = result.workflowRun;
  if (!stored) {
    return {
      target: "workflow_run",
      ok: false,
      summary: "Failed to write workflow run",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "workflow_run",
    ok: true,
    summary: `Wrote workflow run ${stored.id} as ${stored.state}`,
    writtenAt,
    sourceKey: `controlled-run:${input.run.id}:workflow_run`,
    workflowRunId: stored.id,
  } satisfies ControlledWritebackReceipt;
}

async function writeDraft(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildDraftInput(input, writtenAt);
  const result = await upsertDraftInStore(payload);
  const stored = result.draft;
  if (!stored) {
    return {
      target: "draft",
      ok: false,
      summary: "Failed to write draft",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "draft",
    ok: true,
    summary: `Wrote draft ${stored.id}`,
    writtenAt,
    assetId: stored.id,
    sourceKey: `controlled-run:${input.run.id}:draft`,
    workflowRunId: stored.workflowRunId,
  } satisfies ControlledWritebackReceipt;
}

async function writeSalesAsset(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildSalesAssetInput(input);
  const result = await upsertSalesAssetInStore(payload);
  const stored = result.salesAsset;
  if (!stored) {
    return {
      target: "sales_asset",
      ok: false,
      summary: "Failed to write sales asset",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "sales_asset",
    ok: true,
    summary: `Wrote sales asset ${stored.id} for workflow ${stored.workflowRunId}`,
    writtenAt,
    assetId: stored.id,
    sourceKey: `controlled-run:${input.run.id}:sales_asset`,
    workflowRunId: stored.workflowRunId,
  } satisfies ControlledWritebackReceipt;
}

async function writeKnowledgeAsset(input: WriteControlledStepAssetsInput, writtenAt: number) {
  const payload = buildKnowledgeAssetInput(input);
  const result = await upsertKnowledgeAssetInStore(payload);
  const stored = result.knowledgeAsset;
  if (!stored) {
    return {
      target: "knowledge_asset",
      ok: false,
      summary: "Failed to write knowledge asset",
      writtenAt,
    } satisfies ControlledWritebackReceipt;
  }
  return {
    target: "knowledge_asset",
    ok: true,
    summary: `Wrote knowledge asset ${stored.id} from ${stored.sourceKey}`,
    writtenAt,
    assetId: stored.id,
    sourceKey: stored.sourceKey,
    workflowRunId: stored.workflowRunId,
  } satisfies ControlledWritebackReceipt;
}

export async function writeControlledStepAssets(
  input: WriteControlledStepAssetsInput,
): Promise<ControlledWritebackReceipt[]> {
  if (!input.step?.writesTo) return [];
  const writtenAt = Date.now();
  const receipts: ControlledWritebackReceipt[] = [];

  for (const target of input.step.writesTo) {
    if (target.when === "after_approval" && !input.approved) {
      receipts.push({
        target: target.target,
        ok: false,
        summary: "Skipped because output is not approved",
        writtenAt,
      });
      continue;
    }

    try {
      if (target.target === "sales_asset") {
        receipts.push(await writeSalesAsset(input, writtenAt));
      } else if (target.target === "knowledge_asset") {
        receipts.push(await writeKnowledgeAsset(input, writtenAt));
      } else if (target.target === "workflow_run") {
        receipts.push(await writeWorkflowRun(input, writtenAt));
      } else if (target.target === "draft") {
        receipts.push(await writeDraft(input, writtenAt));
      } else {
        receipts.push({
          target: target.target,
          ok: false,
          summary: `Skipped unsupported writeback target ${target.target}`,
          writtenAt,
        });
      }
    } catch (error) {
      receipts.push({
        target: target.target,
        ok: false,
        summary: error instanceof Error ? error.message : "Writeback failed",
        writtenAt,
      });
    }
  }

  return receipts;
}

export function buildWritebackReceipts(input: {
  step: ControlledPlaybookStep | null;
  approved: boolean;
}): ControlledWritebackReceipt[] {
  if (!input.step?.writesTo) return [];
  const writtenAt = Date.now();
  return input.step.writesTo.map((target) => {
    const requiresApproval = target.when === "after_approval";
    if (requiresApproval && !input.approved) {
      return {
        target: target.target,
        ok: false,
        summary: "Skipped because output is not approved",
        writtenAt,
      };
    }
    return {
      target: target.target,
      ok: true,
      summary: `Accepted writeback target ${target.target}`,
      writtenAt,
    };
  });
}

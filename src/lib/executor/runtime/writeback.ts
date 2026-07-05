import type { StepResult } from "@/lib/executor/contracts";
import type { ControlledPlaybookStep } from "@/lib/executor/playbooks/types";
import type {
  ControlledExecutionRunRecord,
  ControlledWritebackReceipt,
} from "@/lib/executor/runtime/types";
import { upsertKnowledgeAssetInStore } from "@/lib/server/knowledge-asset-store";
import { upsertSalesAssetInStore } from "@/lib/server/sales-asset-store";

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

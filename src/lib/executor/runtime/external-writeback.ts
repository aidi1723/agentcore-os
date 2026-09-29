import type { StepResult } from "@/lib/executor/contracts";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";
import {
  postPublishWebhook,
  PublishWebhookTransportError,
} from "@/lib/server/publish-webhook-transport";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function outputFor(results: StepResult[], stepId: string) {
  const match = [...results].reverse().find((result) => result.stepId === stepId);
  return isRecord(match?.output) ? match.output : {};
}

export function buildSalesExternalWritebackPayload(input: {
  run: ControlledExecutionRunRecord;
  previousResults: StepResult[];
  result: StepResult;
}) {
  const allResults = [...input.previousResults, input.result];
  const intake = outputFor(allResults, "intake");
  const normalizedLead = isRecord(intake.normalizedLead) ? intake.normalizedLead : {};
  const draft = outputFor(allResults, "draft_outreach");
  const review = outputFor(allResults, "human_review");
  const workflowRunId = input.run.workflowRunId?.trim() || input.run.id;
  const approvedBody =
    stringValue(review.approvedBody) ||
    stringValue(isRecord(input.result.output) ? input.result.output.knowledgeAssetCandidate : "") ||
    stringValue(draft.body);

  return {
    playbookId: "sales-pipeline-v1",
    runId: input.run.id,
    workflowRunId,
    idempotencyKey: input.run.id,
    company: stringValue(normalizedLead.company),
    subject: stringValue(draft.subject),
    approvedBody,
  };
}

export async function deliverSalesExternalWriteback(input: {
  url: string;
  payload: ReturnType<typeof buildSalesExternalWritebackPayload>;
}) {
  try {
    const response = await postPublishWebhook({
      url: input.url,
      body: JSON.stringify(input.payload),
      timeoutMs: 15_000,
    });
    if (!response.ok) {
      return { ok: false as const, error: `外部写回返回 ${response.status}` };
    }
    return { ok: true as const, status: response.status };
  } catch (error) {
    if (error instanceof PublishWebhookTransportError) {
      return { ok: false as const, error: error.message };
    }
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "外部写回失败",
    };
  }
}

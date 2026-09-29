import type { AgentCoreExecutorLlmConfig, ExecutionStep, StepResult } from "@/lib/executor/contracts";
import { requestServerLlmText } from "@/lib/server/direct-llm";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stringField(output: unknown, field: string) {
  if (!isRecord(output)) return "";
  const value = output[field];
  return typeof value === "string" ? value : "";
}

export function parseModelJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return JSON.parse(fenced ? fenced[1].trim() : trimmed);
}

export function buildControlledModelPrompt(input: {
  userMessage: string;
  step: Pick<ExecutionStep, "id" | "title" | "description" | "outputSchema">;
  previousResults: StepResult[];
}) {
  const previous = input.previousResults
    .filter((result) => result.status === "completed")
    .map((result) => ({ stepId: result.stepId, output: result.output }));
  return [
    `用户输入：${input.userMessage}`,
    `当前步骤：${input.step.id} ${input.step.title}`,
    input.step.description,
    "只返回一个 JSON 对象，不要 Markdown。",
    "不要编造价格、交期或赔偿承诺。未知内容放进 schema 里的数组字段。",
    `输出必须符合：${JSON.stringify(input.step.outputSchema ?? {})}`,
    `前面步骤：${JSON.stringify(previous)}`,
  ].join("\n");
}

export async function generateControlledModelStep(input: {
  llm?: AgentCoreExecutorLlmConfig | null;
  userMessage: string;
  step: Pick<ExecutionStep, "id" | "title" | "description" | "outputSchema">;
  previousResults: StepResult[];
}) {
  const response = await requestServerLlmText({
    llm: input.llm,
    systemPrompt: "你是受控剧本的步骤执行器。只输出符合给定 schema 的 JSON 对象。",
    userPrompt: buildControlledModelPrompt(input),
    temperature: 0.2,
  });
  if (!response.ok) return response;

  try {
    return { ok: true as const, output: parseModelJson(response.text) };
  } catch {
    return { ok: false as const, error: "模型没有返回可解析的 JSON" };
  }
}

export function buildControlledHumanOutput(input: {
  playbookId: string | undefined;
  stepId: string;
  previousResults: StepResult[];
}) {
  const outputFor = (stepId: string) =>
    input.previousResults.find((result) => result.stepId === stepId && result.status === "completed")?.output;

  if (input.playbookId === "sales-pipeline-v1" && input.stepId === "human_review") {
    const body = stringField(outputFor("draft_outreach"), "body");
    if (!body) return null;
    return {
      approved: true,
      approvedBody: body,
      reviewNotes: "人工批准",
    };
  }

  if (input.playbookId === "sales-pipeline-v1" && input.stepId === "writeback") {
    const body = stringField(outputFor("human_review"), "approvedBody");
    if (!body) return null;
    return {
      salesAssetUpdated: true,
      knowledgeAssetCandidate: body,
    };
  }

  if (input.playbookId === "support-resolution-v1" && input.stepId === "human_review") {
    const body = stringField(outputFor("draft_reply"), "body");
    if (!body) return null;
    return {
      approved: true,
      approvedReply: body,
      reviewNotes: "人工批准",
      nextAction: stringField(outputFor("classify"), "nextAction") || "等待复核后的下一步",
    };
  }

  if (input.playbookId === "support-resolution-v1" && input.stepId === "writeback") {
    const reply = stringField(outputFor("human_review"), "approvedReply");
    if (!reply) return null;
    return {
      supportAssetUpdated: true,
      knowledgeAssetCandidate: reply,
      faqCandidate: reply,
    };
  }

  return null;
}

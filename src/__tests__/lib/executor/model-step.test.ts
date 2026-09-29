import { describe, expect, it } from "vitest";
import type { StepResult } from "@/lib/executor/contracts";
import { buildControlledHumanOutput, parseModelJson } from "@/lib/executor/runtime/model-step";

function completed(stepId: string, output: Record<string, unknown>): StepResult {
  return {
    stepId,
    status: "completed",
    output,
    toolCallResults: [],
    tokensUsed: 0,
    durationMs: 0,
  };
}

describe("controlled model step helpers", () => {
  it("parses a fenced JSON object", () => {
    expect(parseModelJson('```json\n{"summary":"ok"}\n```')).toEqual({ summary: "ok" });
  });

  it("builds the approved sales review from the model draft", () => {
    expect(
      buildControlledHumanOutput({
        playbookId: "sales-pipeline-v1",
        stepId: "human_review",
        previousResults: [completed("draft_outreach", { body: "模型草稿正文" })],
      }),
    ).toEqual({
      approved: true,
      approvedBody: "模型草稿正文",
      reviewNotes: "人工批准",
    });
  });

  it("does not invent a review when the draft body is missing", () => {
    expect(
      buildControlledHumanOutput({
        playbookId: "sales-pipeline-v1",
        stepId: "human_review",
        previousResults: [completed("draft_outreach", { subject: "只有标题" })],
      }),
    ).toBeNull();
  });
});

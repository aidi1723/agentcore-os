import { describe, it, expect, vi } from "vitest";
import { planSteps, buildSingleStepPlan } from "@/lib/executor/planner";
import type { AgentCoreTaskRequest } from "@/lib/executor/contracts";

function makeRequest(message: string): AgentCoreTaskRequest {
  return {
    session: { id: "sess_test" },
    taskInput: { userMessage: message },
    context: { systemPrompt: "", workspace: null },
    skillPolicy: { enabled: false, mode: "off" },
    executionPolicy: {},
    metadata: {
      source: "test",
      requestId: "req_test",
      idempotencyKey: "idem_test",
    },
    multiStep: { enabled: true, maxSteps: 5 },
  } as unknown as AgentCoreTaskRequest;
}

describe("planner", () => {
  describe("planSteps", () => {
    it("parses valid JSON steps from LLM output", async () => {
      const mockLlm = vi.fn().mockResolvedValue(
        JSON.stringify([
          { id: "step_1", title: "Research", description: "Find info", toolCalls: [{ toolName: "knowledge_search" }], dependsOn: [], mode: "auto" },
          { id: "step_2", title: "Generate", description: "Write output", toolCalls: [{ toolName: "llm_generate" }], dependsOn: ["step_1"], mode: "auto" },
        ]),
      );

      const plan = await planSteps(makeRequest("write a report"), mockLlm);

      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].id).toBe("step_1");
      expect(plan.steps[1].dependsOn).toEqual(["step_1"]);
      expect(plan.totalSteps).toBe(2);
    });

    it("returns empty steps when LLM returns garbage twice", async () => {
      const mockLlm = vi.fn().mockResolvedValue("I cannot help with that.");
      const plan = await planSteps(makeRequest("do something"), mockLlm);
      expect(plan.steps).toHaveLength(0);
      expect(mockLlm).toHaveBeenCalledTimes(2); // retried once
    });

    it("succeeds on retry when first attempt is garbage", async () => {
      const mockLlm = vi.fn()
        .mockResolvedValueOnce("Let me think about this...")
        .mockResolvedValueOnce(JSON.stringify([
          { id: "s1", title: "Do it", toolCalls: [], dependsOn: [], mode: "auto" },
        ]));
      const plan = await planSteps(makeRequest("task"), mockLlm);
      expect(plan.steps).toHaveLength(1);
      expect(mockLlm).toHaveBeenCalledTimes(2);
    });

    it("respects maxSteps from request", async () => {
      const steps = Array.from({ length: 20 }, (_, i) => ({
        id: `step_${i}`,
        title: `Step ${i}`,
        description: "",
        toolCalls: [],
        dependsOn: [],
        mode: "auto",
      }));
      const mockLlm = vi.fn().mockResolvedValue(JSON.stringify(steps));
      const plan = await planSteps(makeRequest("big task"), mockLlm);
      expect(plan.steps.length).toBeLessThanOrEqual(5);
    });

    it("extracts JSON from markdown-wrapped response", async () => {
      const mockLlm = vi.fn().mockResolvedValue(
        "Here is the plan:\n```json\n" +
          JSON.stringify([{ id: "s1", title: "Do it", toolCalls: [], dependsOn: [], mode: "auto" }]) +
          "\n```",
      );
      const plan = await planSteps(makeRequest("task"), mockLlm);
      expect(plan.steps).toHaveLength(1);
    });
  });

  describe("buildSingleStepPlan", () => {
    it("creates a one-step plan", () => {
      const plan = buildSingleStepPlan("simple task", [{ toolName: "llm_generate" }]);
      expect(plan.steps).toHaveLength(1);
      expect(plan.totalSteps).toBe(1);
      expect(plan.requiresApproval).toBe(false);
      expect(plan.steps[0].toolCalls[0].toolName).toBe("llm_generate");
    });
  });
});

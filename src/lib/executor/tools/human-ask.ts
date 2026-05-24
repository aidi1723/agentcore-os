import type { ToolCallResult } from "@/lib/executor/contracts";
import type { ToolDefinition, ToolContext } from "@/lib/executor/tools/registry";
import { registerTool } from "@/lib/executor/tools/registry";

type HumanAskParams = {
  question: string;
  options?: string[];
};

async function execute(params: unknown, _ctx: ToolContext): Promise<ToolCallResult> {
  const start = Date.now();
  const { question, options } = params as HumanAskParams;

  // This tool signals the executor to pause and wait for human input.
  // The actual waiting is handled by the step executor via ExecutionCallbacks.
  // Here we just return the question as output so the executor knows what to ask.
  return {
    toolName: "human_ask",
    success: true,
    output: { question, options: options ?? [], awaitingHuman: true },
    durationMs: Date.now() - start,
  };
}

export const humanAskTool: ToolDefinition = {
  name: "human_ask",
  description: "Pause execution and ask the human user a question",
  parameters: {
    type: "object",
    properties: {
      question: { type: "string", description: "The question to ask the user" },
      options: {
        type: "array",
        items: { type: "string" },
        description: "Optional list of choices",
      },
    },
    required: ["question"],
  },
  requiresApproval: false,
  execute,
};

registerTool(humanAskTool);

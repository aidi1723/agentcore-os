import type { ToolCallResult } from "@/lib/executor/contracts";
import type { ToolDefinition, ToolContext } from "@/lib/executor/tools/registry";
import { registerTool } from "@/lib/executor/tools/registry";

type LlmGenerateParams = {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
};

async function execute(params: unknown, ctx: ToolContext): Promise<ToolCallResult> {
  const start = Date.now();
  const { prompt, systemPrompt, maxTokens } = params as LlmGenerateParams;

  try {
    const base = ctx.baseUrl || process.env.AGENTCORE_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${base}/api/llm/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          { role: "user", content: prompt },
        ],
        stream: false,
        maxTokens: maxTokens ?? 4096,
      }),
      signal: ctx.abortSignal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        toolName: "llm_generate",
        success: false,
        output: null,
        durationMs: Date.now() - start,
        sideEffects: [`LLM call failed: ${response.status} ${text.slice(0, 200)}`],
      };
    }

    const data = await response.json();
    const text = data?.text ?? data?.choices?.[0]?.message?.content ?? "";
    const tokensUsed = data?.usage?.total_tokens ?? data?.usage?.completion_tokens ?? 0;

    return {
      toolName: "llm_generate",
      success: true,
      output: text,
      tokensUsed,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      toolName: "llm_generate",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: [`LLM call error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export const llmGenerateTool: ToolDefinition = {
  name: "llm_generate",
  description: "Call an LLM to generate text from a prompt",
  parameters: {
    type: "object",
    properties: {
      prompt: { type: "string", description: "The user prompt to send" },
      systemPrompt: { type: "string", description: "Optional system prompt" },
      maxTokens: { type: "number", description: "Max tokens to generate" },
    },
    required: ["prompt"],
  },
  requiresApproval: false,
  execute,
};

registerTool(llmGenerateTool);

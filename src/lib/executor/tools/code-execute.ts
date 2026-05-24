import type { ToolCallResult } from "@/lib/executor/contracts";
import type { ToolDefinition, ToolContext } from "@/lib/executor/tools/registry";
import { registerTool } from "@/lib/executor/tools/registry";

type CodeExecuteParams = {
  code: string;
  language?: string;
  timeout?: number;
};

async function execute(params: unknown, ctx: ToolContext): Promise<ToolCallResult> {
  const start = Date.now();
  const { code, language, timeout } = params as CodeExecuteParams;

  if (typeof code !== "string" || !code.trim()) {
    return {
      toolName: "code_execute",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: ["Missing code for code_execute"],
    };
  }

  try {
    const base = ctx.baseUrl || process.env.AGENTCORE_BASE_URL || "http://localhost:3000";
    const response = await fetch(`${base}/api/runtime/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        language: language ?? "python",
        timeout: timeout ?? 30,
      }),
      signal: ctx.abortSignal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        toolName: "code_execute",
        success: false,
        output: null,
        durationMs: Date.now() - start,
        sideEffects: [`Code execution failed: ${response.status} ${text.slice(0, 200)}`],
      };
    }

    const data = await response.json();
    return {
      toolName: "code_execute",
      success: true,
      output: data,
      durationMs: Date.now() - start,
      sideEffects: [`Executed ${language ?? "python"} code (${code.length} chars)`],
    };
  } catch (err) {
    return {
      toolName: "code_execute",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: [`Code execution error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export const codeExecuteTool: ToolDefinition = {
  name: "code_execute",
  description: "Execute a code snippet via the runtime sidecar",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string", description: "Code to execute" },
      language: { type: "string", description: "Language (default: python)" },
      timeout: { type: "number", description: "Timeout in seconds (default: 30)" },
    },
    required: ["code"],
  },
  requiresApproval: true,
  execute,
};

registerTool(codeExecuteTool);

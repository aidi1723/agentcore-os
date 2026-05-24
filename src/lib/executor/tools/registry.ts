import type { ToolCallResult } from "@/lib/executor/contracts";

export type JSONSchema = Record<string, unknown>;

export type ToolContext = {
  sessionId: string;
  requestId: string;
  baseUrl?: string;
  workingDir?: string;
  abortSignal?: AbortSignal;
};

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: JSONSchema;
  requiresApproval: boolean;
  execute: (params: unknown, ctx: ToolContext) => Promise<ToolCallResult>;
};

const toolMap = new Map<string, ToolDefinition>();

export function registerTool(tool: ToolDefinition): void {
  toolMap.set(tool.name, tool);
}

export function getTool(name: string): ToolDefinition | undefined {
  return toolMap.get(name);
}

export function listTools(): ToolDefinition[] {
  return Array.from(toolMap.values());
}

export function listToolNames(): string[] {
  return Array.from(toolMap.keys());
}

export function getToolsForStep(
  allowedTools?: string[],
  forbiddenTools?: string[],
): ToolDefinition[] {
  const all = listTools();
  const forbidden = new Set(forbiddenTools ?? []);
  if (allowedTools) {
    const allowed = new Set(allowedTools);
    return all.filter((t) => allowed.has(t.name) && !forbidden.has(t.name));
  }
  return all.filter((t) => !forbidden.has(t.name));
}

import type { ToolCallResult } from "@/lib/executor/contracts";
import type { ToolDefinition, ToolContext } from "@/lib/executor/tools/registry";
import { registerTool } from "@/lib/executor/tools/registry";

type KnowledgeSearchParams = {
  query: string;
  scope?: string;
  maxResults?: number;
};

async function execute(params: unknown, ctx: ToolContext): Promise<ToolCallResult> {
  const start = Date.now();
  const { query, scope, maxResults } = params as KnowledgeSearchParams;

  try {
    const base = ctx.baseUrl || process.env.AGENTCORE_BASE_URL || "http://localhost:3000";
    const url = new URL("/api/runtime/state/knowledge-assets", base);
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: ctx.abortSignal,
    });

    if (!response.ok) {
      return {
        toolName: "knowledge_search",
        success: false,
        output: null,
        durationMs: Date.now() - start,
        sideEffects: [`Knowledge search failed: ${response.status}`],
      };
    }

    const data = await response.json();
    const assets = Object.values(data ?? {}) as Array<Record<string, unknown>>;

    const queryLower = query.toLowerCase();
    const matches = assets
      .filter((asset) => {
        const title = String(asset.title ?? "").toLowerCase();
        const body = String(asset.body ?? "").toLowerCase();
        const tags = Array.isArray(asset.tags) ? asset.tags.join(" ").toLowerCase() : "";
        if (scope && asset.sourceKey !== scope) return false;
        return title.includes(queryLower) || body.includes(queryLower) || tags.includes(queryLower);
      })
      .slice(0, maxResults ?? 5);

    return {
      toolName: "knowledge_search",
      success: true,
      output: matches,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      toolName: "knowledge_search",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: [`Knowledge search error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export const knowledgeSearchTool: ToolDefinition = {
  name: "knowledge_search",
  description: "Search the knowledge vault for relevant assets by keyword",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      scope: { type: "string", description: "Optional scope filter (sourceKey)" },
      maxResults: { type: "number", description: "Max results to return (default 5)" },
    },
    required: ["query"],
  },
  requiresApproval: false,
  execute,
};

registerTool(knowledgeSearchTool);

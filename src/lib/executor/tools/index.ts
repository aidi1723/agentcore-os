// Import all tool modules to trigger registration via registerTool()
import "@/lib/executor/tools/llm-generate";
import "@/lib/executor/tools/knowledge-search";
import "@/lib/executor/tools/file-ops";
import "@/lib/executor/tools/code-execute";
import "@/lib/executor/tools/human-ask";

export { registerTool, getTool, listTools, listToolNames, getToolsForStep } from "@/lib/executor/tools/registry";
export type { ToolDefinition, ToolContext, JSONSchema } from "@/lib/executor/tools/registry";

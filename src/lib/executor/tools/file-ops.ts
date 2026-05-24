import { promises as fs } from "node:fs";
import path from "node:path";
import type { ToolCallResult } from "@/lib/executor/contracts";
import type { ToolDefinition, ToolContext } from "@/lib/executor/tools/registry";
import { registerTool } from "@/lib/executor/tools/registry";

const OUTPUT_DIR = path.resolve(process.cwd(), "output");

function safePath(name: string): string | null {
  const resolved = path.resolve(OUTPUT_DIR, name);
  if (!resolved.startsWith(OUTPUT_DIR)) return null;
  return resolved;
}

// --- file_read ---

type FileReadParams = { path: string };

async function executeRead(params: unknown, ctx: ToolContext): Promise<ToolCallResult> {
  const start = Date.now();
  const { path: filePath } = params as FileReadParams;
  const resolved = safePath(filePath);

  if (!resolved) {
    return {
      toolName: "file_read",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: ["Path traversal blocked"],
    };
  }

  try {
    const content = await fs.readFile(resolved, "utf-8");
    return {
      toolName: "file_read",
      success: true,
      output: content,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      toolName: "file_read",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: [`Read error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export const fileReadTool: ToolDefinition = {
  name: "file_read",
  description: "Read a file from the output/ directory",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path within output/" },
    },
    required: ["path"],
  },
  requiresApproval: false,
  execute: executeRead,
};

// --- file_write ---

type FileWriteParams = { path: string; content: string };

async function executeWrite(params: unknown, ctx: ToolContext): Promise<ToolCallResult> {
  const start = Date.now();
  const { path: filePath, content } = params as FileWriteParams;
  const resolved = safePath(filePath);

  if (!resolved) {
    return {
      toolName: "file_write",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: ["Path traversal blocked"],
    };
  }

  try {
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf-8");
    return {
      toolName: "file_write",
      success: true,
      output: { written: resolved },
      durationMs: Date.now() - start,
      sideEffects: [`Wrote file: ${filePath}`],
    };
  } catch (err) {
    return {
      toolName: "file_write",
      success: false,
      output: null,
      durationMs: Date.now() - start,
      sideEffects: [`Write error: ${err instanceof Error ? err.message : String(err)}`],
    };
  }
}

export const fileWriteTool: ToolDefinition = {
  name: "file_write",
  description: "Write content to a file in the output/ directory",
  parameters: {
    type: "object",
    properties: {
      path: { type: "string", description: "Relative path within output/" },
      content: { type: "string", description: "File content to write" },
    },
    required: ["path", "content"],
  },
  requiresApproval: true,
  execute: executeWrite,
};

registerTool(fileReadTool);
registerTool(fileWriteTool);

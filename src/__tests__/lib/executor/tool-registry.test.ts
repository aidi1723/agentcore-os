import { describe, it, expect, beforeEach } from "vitest";

describe("tool registry", () => {
  beforeEach(async () => {
    // Import to ensure module is loaded
    await import("@/lib/executor/tools/registry");
  });

  it("registers and retrieves a tool", async () => {
    const { registerTool, getTool, listToolNames } = await import(
      "@/lib/executor/tools/registry"
    );

    registerTool({
      name: "test_tool",
      description: "A test tool",
      parameters: { type: "object", properties: {} },
      requiresApproval: false,
      execute: async () => ({
        toolName: "test_tool",
        success: true,
        output: "ok",
        durationMs: 1,
      }),
    });

    expect(getTool("test_tool")).toBeDefined();
    expect(listToolNames()).toContain("test_tool");
  });

  it("returns undefined for unknown tool", async () => {
    const { getTool } = await import("@/lib/executor/tools/registry");
    expect(getTool("nonexistent_xyz")).toBeUndefined();
  });

  it("getToolsForStep filters by allowed and forbidden", async () => {
    const { registerTool, getToolsForStep } = await import(
      "@/lib/executor/tools/registry"
    );

    const makeTool = (name: string) => ({
      name,
      description: name,
      parameters: { type: "object" as const, properties: {} },
      requiresApproval: false,
      execute: async () => ({ toolName: name, success: true, output: null, durationMs: 0 }),
    });

    registerTool(makeTool("alpha"));
    registerTool(makeTool("beta"));
    registerTool(makeTool("gamma"));

    const allowed = getToolsForStep(["alpha", "beta"], ["beta"]);
    expect(allowed.map((t) => t.name)).toEqual(["alpha"]);
  });
});

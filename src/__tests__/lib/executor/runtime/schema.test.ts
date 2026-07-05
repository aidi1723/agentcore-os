import { describe, expect, it } from "vitest";
import { validateControlledOutput } from "@/lib/executor/runtime/schema";

describe("validateControlledOutput", () => {
  const schema = {
    type: "object" as const,
    required: ["summary", "priority"],
    properties: {
      summary: { type: "string" },
      priority: { enum: ["high", "medium", "low"] },
      risks: { type: "array", items: { type: "string" } },
    },
    additionalProperties: false,
  };

  it("accepts output matching the schema subset", () => {
    const result = validateControlledOutput(
      { summary: "qualified", priority: "high", risks: ["budget unknown"] },
      schema,
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("rejects missing required fields", () => {
    const result = validateControlledOutput({ summary: "qualified" }, schema);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: priority");
  });

  it("rejects wrong primitive types and enum values", () => {
    const result = validateControlledOutput(
      { summary: 123, priority: "urgent", risks: ["x"] },
      schema,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Field summary must be string");
    expect(result.errors).toContain("Field priority must be one of high, medium, low");
  });

  it("rejects additional properties when disabled", () => {
    const result = validateControlledOutput(
      { summary: "qualified", priority: "low", extra: true },
      schema,
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Unexpected field: extra");
  });
});

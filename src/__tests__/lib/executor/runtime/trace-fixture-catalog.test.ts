import { describe, expect, it } from "vitest";
import { controlledTraceFixtureCatalog } from "@/__tests__/fixtures/controlled-traces/catalog";
import { validateControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";
import { replayControlledTraceFixture } from "@/lib/executor/runtime/trace-replay";

describe("controlled trace fixture catalog", () => {
  it("lists sales and support governed fixtures", () => {
    expect(controlledTraceFixtureCatalog.map((entry) => entry.id)).toEqual([
      "sales-pipeline-governed",
      "support-resolution-governed",
    ]);
  });

  it("validates and replays every committed governed fixture", () => {
    for (const entry of controlledTraceFixtureCatalog) {
      expect(entry.fixture.playbookId).toBe(entry.playbookId);
      expect(validateControlledTraceFixture(entry.fixture)).toEqual({ ok: true, errors: [] });

      const replay = replayControlledTraceFixture(entry.fixture);
      expect(replay.errors).toEqual([]);
      expect(replay.ok).toBe(true);
      expect(replay.guarantees).toEqual({
        toolCallsExecuted: false,
        assetsWritten: false,
      });
    }
  });

  it("does not include raw customer content or secret markers", () => {
    const serialized = JSON.stringify(controlledTraceFixtureCatalog);

    expect(serialized).not.toContain("Nora");
    expect(serialized).not.toContain("sk-fixture-secret");
    expect(serialized).not.toContain("refund my order");
    expect(serialized).not.toContain("Bearer ");
  });
});

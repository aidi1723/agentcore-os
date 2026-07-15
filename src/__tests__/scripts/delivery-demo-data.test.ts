import { describe, expect, it } from "vitest";
import {
  buildDeliveryDemoData,
  DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
  DELIVERY_DEMO_COMPLETED_RUN_ID,
  DELIVERY_DEMO_FAILED_RUN_ID,
} from "../../../scripts/delivery-demo/demo-data.mjs";

describe("delivery demo data", () => {
  it("builds stable controlled runtime demo runs for completed, approval, and retry states", () => {
    const data = buildDeliveryDemoData({ now: 1_800_000_000_000 });

    expect(data.controlledRuns.map((run) => run.id)).toEqual([
      DELIVERY_DEMO_COMPLETED_RUN_ID,
      DELIVERY_DEMO_AWAITING_APPROVAL_RUN_ID,
      DELIVERY_DEMO_FAILED_RUN_ID,
    ]);
    expect(data.controlledRuns.map((run) => run.state)).toEqual([
      "completed",
      "awaiting_approval",
      "failed",
    ]);
    const receipts: unknown[] | undefined =
      data.controlledRuns[0].steps.at(-1)?.writebackReceipts;
    expect(receipts).toBeDefined();
    if (!receipts) throw new Error("Expected completed writeback receipts");
    expect(
      receipts.map((receipt) => {
        if (
          !receipt ||
          typeof receipt !== "object" ||
          !("target" in receipt) ||
          typeof receipt.target !== "string"
        ) {
          throw new Error("Expected writeback target");
        }
        return receipt.target;
      }),
    ).toEqual(["sales_asset", "knowledge_asset", "workflow_run", "draft", "support_asset"]);
    expect(
      data.controlledRuns[1].steps.some(
        (step) => "approval" in step && step.approval?.state === "pending",
      ),
    ).toBe(true);
    expect(data.controlledRuns[2].plan.steps.some((step) => step.onFailure?.action === "retry")).toBe(
      true,
    );
  });

  it("keeps raw secrets out of demo records", () => {
    const serialized = JSON.stringify(buildDeliveryDemoData({ now: 1_800_000_000_000 }));

    expect(serialized).not.toMatch(/sk-/i);
    expect(serialized).not.toMatch(/secret/i);
    expect(serialized).not.toMatch(/nora@example\.com/i);
  });
});

import { describe, expect, it } from "vitest";
import { buildDeliveryDemoData } from "../../../scripts/delivery-demo/demo-data.mjs";
import { checkDeliveryDemoState } from "../../../scripts/delivery-demo/check-controlled-runtime-demo.mjs";
import { mergeDeliveryDemoRecords } from "../../../scripts/delivery-demo/seed-controlled-runtime-demo.mjs";

describe("delivery demo scripts", () => {
  it("merges demo records without dropping unrelated local data", () => {
    const merged = mergeDeliveryDemoRecords(
      [
        { id: "unrelated", updatedAt: 10, value: "keep" },
        { id: "delivery-demo-sales-asset", updatedAt: 1, value: "old" },
      ],
      [{ id: "delivery-demo-sales-asset", updatedAt: 20, value: "new" }],
    );

    expect(merged).toEqual([
      { id: "delivery-demo-sales-asset", updatedAt: 20, value: "new" },
      { id: "unrelated", updatedAt: 10, value: "keep" },
    ]);
  });

  it("checks seeded demo state and rejects missing governed assets", () => {
    const data = buildDeliveryDemoData({ now: 1_800_000_000_000 });

    expect(checkDeliveryDemoState(data)).toMatchObject({ ok: true });

    const broken = {
      ...data,
      drafts: [],
    };

    expect(checkDeliveryDemoState(broken)).toMatchObject({
      ok: false,
      diagnostics: expect.arrayContaining([
        "missing draft delivery-demo-draft",
      ]),
    });
  });
});

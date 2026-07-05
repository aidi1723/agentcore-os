import type { ControlledPlaybookStep } from "@/lib/executor/playbooks/types";
import type { ControlledWritebackReceipt } from "@/lib/executor/runtime/types";

export function buildWritebackReceipts(input: {
  step: ControlledPlaybookStep | null;
  approved: boolean;
}): ControlledWritebackReceipt[] {
  if (!input.step?.writesTo) return [];
  const writtenAt = Date.now();
  return input.step.writesTo.map((target) => {
    const requiresApproval = target.when === "after_approval";
    if (requiresApproval && !input.approved) {
      return {
        target: target.target,
        ok: false,
        summary: "Skipped because output is not approved",
        writtenAt,
      };
    }
    return {
      target: target.target,
      ok: true,
      summary: `Accepted writeback target ${target.target}`,
      writtenAt,
    };
  });
}

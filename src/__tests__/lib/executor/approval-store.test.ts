import { describe, it, expect, vi } from "vitest";
import { waitForApproval, resolveApproval } from "@/lib/executor/approval-store";

describe("approval-store", () => {
  it("resolves when approval is granted", async () => {
    const promise = waitForApproval("exec-1", "step-a");
    resolveApproval("exec-1", "step-a", true, "looks good");
    const result = await promise;
    expect(result).toEqual({ approved: true, feedback: "looks good" });
  });

  it("resolves with rejected when denied", async () => {
    const promise = waitForApproval("exec-2", "step-b");
    resolveApproval("exec-2", "step-b", false, "not safe");
    const result = await promise;
    expect(result).toEqual({ approved: false, feedback: "not safe" });
  });

  it("times out after specified duration", async () => {
    vi.useFakeTimers();
    const promise = waitForApproval("exec-3", "step-c", 100);
    vi.advanceTimersByTime(100);
    const result = await promise;
    expect(result).toEqual({ approved: false, feedback: "Approval timeout" });
    vi.useRealTimers();
  });

  it("ignores resolve for unknown key", () => {
    // Should not throw
    resolveApproval("unknown", "unknown", true);
  });
});

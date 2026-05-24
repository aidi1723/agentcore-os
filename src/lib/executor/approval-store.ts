/**
 * In-memory store for pending multi-step execution approvals.
 * Keyed by "executionId:stepId".
 */
const pendingApprovals = new Map<
  string,
  { resolve: (v: { approved: boolean; feedback?: string }) => void }
>();

export function resolveApproval(
  executionId: string,
  stepId: string,
  approved: boolean,
  feedback?: string,
) {
  const key = `${executionId}:${stepId}`;
  const pending = pendingApprovals.get(key);
  if (pending) {
    pending.resolve({ approved, feedback });
    pendingApprovals.delete(key);
  }
}

export function waitForApproval(
  executionId: string,
  stepId: string,
  timeoutMs = 300_000,
): Promise<{ approved: boolean; feedback?: string }> {
  return new Promise((resolve) => {
    const key = `${executionId}:${stepId}`;
    pendingApprovals.set(key, { resolve });
    setTimeout(() => {
      if (pendingApprovals.has(key)) {
        pendingApprovals.delete(key);
        resolve({ approved: false, feedback: "Approval timeout" });
      }
    }, timeoutMs);
  });
}

import {
  requestControlledApproval,
  resolveControlledApproval,
} from "@/lib/server/controlled-execution-store";

const pendingApprovals = new Map<
  string,
  { resolve: (v: { approved: boolean; feedback?: string }) => void }
>();

/**
 * In-memory waiters are process-local; controlled execution approval state is
 * persisted opportunistically so active UI/API flows remain recoverable.
 */
export async function resolveApproval(
  executionId: string,
  stepId: string,
  approved: boolean,
  feedback?: string,
) {
  await resolveControlledApproval(executionId, stepId, { approved, feedback }).catch(() => null);
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
  void requestControlledApproval(executionId, stepId).catch(() => null);
  return new Promise((resolve) => {
    const key = `${executionId}:${stepId}`;
    pendingApprovals.set(key, { resolve });
    setTimeout(() => {
      if (pendingApprovals.has(key)) {
        pendingApprovals.delete(key);
        void resolveControlledApproval(executionId, stepId, {
          approved: false,
          feedback: "Approval timeout",
        }).catch(() => null);
        resolve({ approved: false, feedback: "Approval timeout" });
      }
    }, timeoutMs);
  });
}

"use client";

import { useCallback, useRef, useState } from "react";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import type { ExecutionPlan, ExecutionStep, StepResult } from "@/lib/executor/contracts";
import type {
  ControlledExecutionRunRecord,
  ControlledExecutionStepRecord,
} from "@/lib/executor/runtime/types";

export type MultiStepStatus =
  | "idle"
  | "connecting"
  | "running"
  | "resuming"
  | "awaiting_approval"
  | "done"
  | "error";

export type ApprovalRequest = {
  executionId: string;
  stepId: string;
  title: string;
  description?: string;
  mode?: string;
};

export type MultiStepStreamState = {
  status: MultiStepStatus;
  executionId: string | null;
  plan: ExecutionPlan | null;
  currentStepId: string | null;
  stepResults: StepResult[];
  approvalRequest: ApprovalRequest | null;
  error: string | null;
};

type ResumeResponse =
  | {
      ok: true;
      data: {
        runId: string;
        state: ControlledExecutionRunRecord["state"];
        resumedStepIds: string[];
        run: ControlledExecutionRunRecord;
      };
    }
  | {
      ok: false;
      error: string;
      data?: {
        runId?: string;
        state?: ControlledExecutionRunRecord["state"];
        currentStepId?: string;
      };
    };

function stepDurationMs(step: ControlledExecutionStepRecord) {
  if (typeof step.startedAt === "number" && typeof step.finishedAt === "number") {
    return Math.max(0, step.finishedAt - step.startedAt);
  }
  return 0;
}

function durableStepToResult(step: ControlledExecutionStepRecord): StepResult | null {
  if (step.state !== "completed" && step.state !== "skipped" && step.state !== "failed") {
    return null;
  }
  return {
    stepId: step.stepId,
    status: step.state,
    output: step.output ?? null,
    toolCallResults: step.toolCallResults ?? [],
    tokensUsed: (step.toolCallResults ?? []).reduce((sum, item) => sum + (item.tokensUsed ?? 0), 0),
    durationMs: stepDurationMs(step),
    error: step.error,
  };
}

function approvalToRequest(
  run: ControlledExecutionRunRecord,
  step: ControlledExecutionStepRecord,
): ApprovalRequest {
  const planStep = run.plan.steps.find((item) => item.id === step.stepId);
  return {
    executionId: run.id,
    stepId: step.stepId,
    title: planStep?.title ?? step.stepId,
    description: planStep?.description,
    mode: planStep?.mode,
  };
}

function projectRunState(run: ControlledExecutionRunRecord): MultiStepStreamState {
  const approvalStep = run.steps.find(
    (step) => step.state === "awaiting_approval" && step.approval?.state === "pending",
  );
  const approvalRequest = approvalStep?.approval
    ? approvalToRequest(run, approvalStep)
    : null;
  const stepResults = run.steps
    .map(durableStepToResult)
    .filter((item): item is StepResult => Boolean(item));
  const error = run.state === "failed" || run.state === "cancelled" ? run.error ?? "Controlled run failed" : null;
  const status: MultiStepStatus =
    run.state === "completed"
      ? "done"
      : run.state === "failed" || run.state === "cancelled"
        ? "error"
        : run.state === "awaiting_approval"
          ? "awaiting_approval"
          : "running";

  return {
    status,
    executionId: run.id,
    plan: run.plan,
    currentStepId: run.currentStepId ?? null,
    stepResults,
    approvalRequest,
    error,
  };
}

export function useMultiStepStream() {
  const [state, setState] = useState<MultiStepStreamState>({
    status: "idle",
    executionId: null,
    plan: null,
    currentStepId: null,
    stepResults: [],
    approvalRequest: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const streamActiveRef = useRef(false);
  const resumeAfterApprovalRef = useRef(false);
  const approvalInFlightRef = useRef(false);

  const start = useCallback(async (message: string, options?: {
    maxSteps?: number;
    approvalMode?: "none" | "each-review-step" | "final";
  }) => {
    abortRef.current?.abort();
    streamActiveRef.current = false;
    resumeAfterApprovalRef.current = false;
    approvalInFlightRef.current = false;
    const controller = new AbortController();
    abortRef.current = controller;

    setState({
      status: "connecting",
      executionId: null,
      plan: null,
      currentStepId: null,
      stepResults: [],
      approvalRequest: null,
      error: null,
    });

    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/agent/stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          maxSteps: options?.maxSteps,
          approvalMode: options?.approvalMode,
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setState((s) => ({ ...s, status: "error", error: `HTTP ${res.status}` }));
        return;
      }

      const executionId = res.headers.get("X-Execution-Id") ?? null;
      setState((s) => ({ ...s, status: "running", executionId }));

      const reader = res.body.getReader();
      streamActiveRef.current = true;
      const decoder = new TextDecoder();
      let buffer = "";
      let executionDone = false;
      let streamFailed = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7);
            } else if (line.startsWith("data: ") && eventType) {
              const data = JSON.parse(line.slice(6));
              if (eventType === "execution_done") {
                executionDone = true;
              } else if (eventType === "error") {
                streamFailed = true;
              }
              handleEvent(eventType, data);
              eventType = "";
            }
          }
        }
      } finally {
        if (abortRef.current === controller) {
          streamActiveRef.current = false;
        }
      }

      if (!executionDone && !streamFailed) {
        setState((s) => ({
          ...s,
          status: "error",
          error: "Stream ended before execution_done",
        }));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  function handleEvent(event: string, data: Record<string, unknown>) {
    switch (event) {
      case "plan_ready":
        setState((s) => ({ ...s, plan: data.plan as ExecutionPlan }));
        break;
      case "step_start":
        setState((s) => ({ ...s, currentStepId: data.stepId as string }));
        break;
      case "step_complete":
        setState((s) => ({
          ...s,
          stepResults: [...s.stepResults, data as unknown as StepResult],
          currentStepId: null,
        }));
        break;
      case "approval_needed":
        setState((s) => ({
          ...s,
          status: "awaiting_approval",
          approvalRequest: data as unknown as ApprovalRequest,
        }));
        break;
      case "execution_done":
        setState((s) =>
          data.ok === true
            ? (() => {
                resumeAfterApprovalRef.current = false;
                return { ...s, status: "done" };
              })()
            : s.status !== "error" &&
                s.approvalRequest &&
                typeof data.error === "string" &&
                data.error.toLowerCase().includes("awaiting approval")
              ? (() => {
                  resumeAfterApprovalRef.current = true;
                  return { ...s, status: "awaiting_approval", error: null };
                })()
            : {
                ...s,
                status: "error",
                error: typeof data.error === "string" ? data.error : "Execution failed",
              },
        );
        break;
      case "error":
        setState((s) => ({ ...s, status: "error", error: data.error as string }));
        break;
    }
  }

  const resume = useCallback(async (runId?: string) => {
    const targetRunId = runId ?? state.executionId;
    if (!targetRunId) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Cannot resume controlled run without an execution id",
      }));
      return;
    }

    setState((s) => ({ ...s, status: "resuming", error: null }));

    try {
      const res = await fetch(
        buildAgentCoreApiUrl(`/api/runtime/executor/controlled-runs/${encodeURIComponent(targetRunId)}/resume`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      let data: ResumeResponse;
      try {
        data = (await res.json()) as ResumeResponse;
      } catch {
        setState((s) => ({
          ...s,
          status: "error",
          error: `Resume failed: HTTP ${res.status}`,
        }));
        return;
      }

      if (res.ok && data.ok) {
        resumeAfterApprovalRef.current = false;
        setState(projectRunState(data.data.run));
        return;
      }

      const error = data.ok === false ? data.error : `Resume failed: HTTP ${res.status}`;
      setState((s) => ({
        ...s,
        status:
          data.ok === false && data.data?.state === "awaiting_approval"
            ? "awaiting_approval"
            : data.ok === false && data.data?.state === "completed"
              ? "done"
              : "error",
        currentStepId: data.ok === false ? data.data?.currentStepId ?? s.currentStepId : s.currentStepId,
        error,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Resume failed",
      }));
    }
  }, [state.executionId]);

  const approve = useCallback(async (approved: boolean, feedback?: string) => {
    if (approvalInFlightRef.current) return;

    const { executionId, approvalRequest } = state;
    if (!executionId || !approvalRequest) return;

    approvalInFlightRef.current = true;
    try {
      const res = await fetch(buildAgentCoreApiUrl("/api/agent/approve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          executionId,
          stepId: approvalRequest.stepId,
          approved,
          feedback,
        }),
      });

      if (!res.ok) {
        setState((s) => ({ ...s, status: "error", error: `Approval failed: HTTP ${res.status}` }));
        return;
      }

      if (!approved) {
        resumeAfterApprovalRef.current = false;
        setState((s) => ({
          ...s,
          status: "error",
          approvalRequest: null,
          error: feedback ?? "User rejected step",
        }));
        return;
      }

      if (resumeAfterApprovalRef.current || !streamActiveRef.current) {
        resumeAfterApprovalRef.current = false;
        setState((s) => ({ ...s, approvalRequest: null }));
        await resume(executionId);
        return;
      }

      setState((s) => ({
        ...s,
        status: "running",
        approvalRequest: null,
        error: null,
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Approval failed",
      }));
    } finally {
      approvalInFlightRef.current = false;
    }
  }, [resume, state]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, status: "done" }));
  }, []);

  const canResume =
    Boolean(state.executionId) &&
    state.status !== "resuming" &&
    (state.status === "error" || (state.status === "awaiting_approval" && !state.approvalRequest));

  return { ...state, start, approve, resume, stop, canResume };
}

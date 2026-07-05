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

type ControlledRunResponse = {
  ok: boolean;
  data?: {
    run?: ControlledExecutionRunRecord;
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
    (step) =>
      step.state === "awaiting_approval" &&
      step.approval?.state !== "approved" &&
      step.approval?.state !== "rejected",
  );
  const approvalRequest = approvalStep
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

const RESUME_CONFLICT_HYDRATION_STATES = new Set<ControlledExecutionRunRecord["state"]>([
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);

async function fetchDurableControlledRun(runId: string): Promise<ControlledExecutionRunRecord | null> {
  try {
    const runRes = await fetch(
      buildAgentCoreApiUrl(`/api/runtime/executor/controlled-runs/${encodeURIComponent(runId)}`),
    );
    const runData = (await runRes.json()) as ControlledRunResponse;
    if (runRes.ok && runData.ok && runData.data?.run) {
      return runData.data.run;
    }
  } catch {
    // Keep the original resume response fallback when durable hydration is unavailable.
  }
  return null;
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
  const resumeInFlightRef = useRef(false);
  const operationGenerationRef = useRef(0);

  const isCurrentGeneration = useCallback((generation: number) => {
    return operationGenerationRef.current === generation;
  }, []);

  const setStateForGeneration = useCallback((
    generation: number,
    updater: (current: MultiStepStreamState) => MultiStepStreamState,
  ) => {
    if (!isCurrentGeneration(generation)) return;
    setState((current) => (
      isCurrentGeneration(generation) ? updater(current) : current
    ));
  }, [isCurrentGeneration]);

  const handleEvent = useCallback((event: string, data: Record<string, unknown>, generation: number) => {
    if (!isCurrentGeneration(generation)) return;

    switch (event) {
      case "plan_ready":
        setStateForGeneration(generation, (s) => ({ ...s, plan: data.plan as ExecutionPlan }));
        break;
      case "step_start":
        setStateForGeneration(generation, (s) => ({ ...s, currentStepId: data.stepId as string }));
        break;
      case "step_complete":
        setStateForGeneration(generation, (s) => ({
          ...s,
          stepResults: [...s.stepResults, data as unknown as StepResult],
          currentStepId: null,
        }));
        break;
      case "approval_needed":
        setStateForGeneration(generation, (s) => ({
          ...s,
          status: "awaiting_approval",
          approvalRequest: data as unknown as ApprovalRequest,
        }));
        break;
      case "execution_done":
        setStateForGeneration(generation, (s) =>
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
        setStateForGeneration(generation, (s) => ({ ...s, status: "error", error: data.error as string }));
        break;
    }
  }, [isCurrentGeneration, setStateForGeneration]);

  const start = useCallback(async (message: string, options?: {
    maxSteps?: number;
    approvalMode?: "none" | "each-review-step" | "final";
  }) => {
    operationGenerationRef.current += 1;
    const generation = operationGenerationRef.current;
    abortRef.current?.abort();
    streamActiveRef.current = false;
    resumeAfterApprovalRef.current = false;
    approvalInFlightRef.current = false;
    resumeInFlightRef.current = false;
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
        setStateForGeneration(generation, (s) => ({ ...s, status: "error", error: `HTTP ${res.status}` }));
        return;
      }

      const executionId = res.headers.get("X-Execution-Id") ?? null;
      setStateForGeneration(generation, (s) => ({ ...s, status: "running", executionId }));

      if (!isCurrentGeneration(generation)) return;
      const reader = res.body.getReader();
      if (!isCurrentGeneration(generation)) return;
      streamActiveRef.current = true;
      const decoder = new TextDecoder();
      let buffer = "";
      let executionDone = false;
      let streamFailed = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (!isCurrentGeneration(generation)) return;
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
                streamActiveRef.current = false;
              } else if (eventType === "error") {
                streamFailed = true;
              }
              handleEvent(eventType, data, generation);
              eventType = "";
            }
          }
        }
      } finally {
        if (abortRef.current === controller && isCurrentGeneration(generation)) {
          streamActiveRef.current = false;
        }
      }

      if (!executionDone && !streamFailed) {
        setStateForGeneration(generation, (s) => ({
          ...s,
          status: "error",
          error: "Stream ended before execution_done",
        }));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setStateForGeneration(generation, (s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, [handleEvent, isCurrentGeneration, setStateForGeneration]);

  const resume = useCallback(async (runId?: string) => {
    if (resumeInFlightRef.current) return;

    const generation = operationGenerationRef.current;
    const targetRunId = runId ?? state.executionId;
    if (!targetRunId) {
      setState((s) => ({
        ...s,
        status: "error",
        error: "Cannot resume controlled run without an execution id",
      }));
      return;
    }

    resumeInFlightRef.current = true;
    streamActiveRef.current = false;
    setState((s) => ({ ...s, status: "resuming", error: null }));

    try {
      const res = await fetch(
        buildAgentCoreApiUrl(`/api/runtime/executor/controlled-runs/${encodeURIComponent(targetRunId)}/resume`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );
      if (!isCurrentGeneration(generation)) return;

      let data: ResumeResponse;
      try {
        data = (await res.json()) as ResumeResponse;
      } catch {
        setStateForGeneration(generation, (s) => ({
          ...s,
          status: "error",
          error: `Resume failed: HTTP ${res.status}`,
        }));
        return;
      }
      if (!isCurrentGeneration(generation)) return;

      if (res.ok && data.ok) {
        const projected = projectRunState(data.data.run);
        resumeAfterApprovalRef.current = Boolean(projected.approvalRequest);
        streamActiveRef.current = false;
        setStateForGeneration(generation, () => projected);
        return;
      }

      const error = data.ok === false ? data.error : `Resume failed: HTTP ${res.status}`;
      if (
        data.ok === false &&
        data.data?.state &&
        RESUME_CONFLICT_HYDRATION_STATES.has(data.data.state)
      ) {
        const durableRun = await fetchDurableControlledRun(data.data.runId ?? targetRunId);
        if (!isCurrentGeneration(generation)) return;
        if (durableRun) {
          const projected = projectRunState(durableRun);
          resumeAfterApprovalRef.current = Boolean(projected.approvalRequest);
          streamActiveRef.current = false;
          setStateForGeneration(generation, () => projected);
          return;
        }
      }

      setStateForGeneration(generation, (s) => ({
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
      if (!isCurrentGeneration(generation)) return;
      setStateForGeneration(generation, (s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Resume failed",
      }));
    } finally {
      if (isCurrentGeneration(generation)) {
        resumeInFlightRef.current = false;
      }
    }
  }, [isCurrentGeneration, setStateForGeneration, state.executionId]);

  const approve = useCallback(async (approved: boolean, feedback?: string) => {
    if (approvalInFlightRef.current) return;

    const { executionId, approvalRequest } = state;
    if (!executionId || !approvalRequest) return;

    const generation = operationGenerationRef.current;
    const shouldResumeAfterApproval = resumeAfterApprovalRef.current && !streamActiveRef.current;
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
      if (!isCurrentGeneration(generation)) return;

      if (!res.ok) {
        setStateForGeneration(generation, (s) => ({ ...s, status: "error", error: `Approval failed: HTTP ${res.status}` }));
        return;
      }

      if (!approved) {
        resumeAfterApprovalRef.current = false;
        setStateForGeneration(generation, (s) => ({
          ...s,
          status: "error",
          approvalRequest: null,
          error: feedback ?? "User rejected step",
        }));
        return;
      }

      if (shouldResumeAfterApproval) {
        resumeAfterApprovalRef.current = false;
        setStateForGeneration(generation, (s) => ({ ...s, approvalRequest: null }));
        await resume(executionId);
        return;
      }

      setStateForGeneration(generation, (s) => ({
        ...s,
        status: s.status === "done" ? "done" : "running",
        approvalRequest: null,
        error: null,
      }));
    } catch (err) {
      if (!isCurrentGeneration(generation)) return;
      setStateForGeneration(generation, (s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Approval failed",
      }));
    } finally {
      if (isCurrentGeneration(generation)) {
        approvalInFlightRef.current = false;
      }
    }
  }, [isCurrentGeneration, resume, setStateForGeneration, state]);

  const stop = useCallback(() => {
    operationGenerationRef.current += 1;
    abortRef.current?.abort();
    streamActiveRef.current = false;
    resumeAfterApprovalRef.current = false;
    approvalInFlightRef.current = false;
    resumeInFlightRef.current = false;
    setState((s) => ({ ...s, status: "done" }));
  }, []);

  const canResume =
    Boolean(state.executionId) &&
    state.status !== "resuming" &&
    (state.status === "error" || (state.status === "awaiting_approval" && !state.approvalRequest));

  return { ...state, start, approve, resume, stop, canResume };
}

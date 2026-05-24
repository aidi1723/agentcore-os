"use client";

import { useCallback, useRef, useState } from "react";

import { buildAgentCoreApiUrl } from "@/lib/app-api";
import type { ExecutionPlan, ExecutionStep, StepResult } from "@/lib/executor/contracts";

export type MultiStepStatus = "idle" | "connecting" | "running" | "awaiting_approval" | "done" | "error";

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

  const start = useCallback(async (message: string, options?: {
    maxSteps?: number;
    approvalMode?: "none" | "each-review-step" | "final";
  }) => {
    abortRef.current?.abort();
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
      const decoder = new TextDecoder();
      let buffer = "";

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
            handleEvent(eventType, data);
            eventType = "";
          }
        }
      }

      setState((s) => (s.status === "running" ? { ...s, status: "done" } : s));
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
        setState((s) => ({ ...s, status: "done" }));
        break;
      case "error":
        setState((s) => ({ ...s, status: "error", error: data.error as string }));
        break;
    }
  }

  const approve = useCallback(async (approved: boolean, feedback?: string) => {
    const { executionId, approvalRequest } = state;
    if (!executionId || !approvalRequest) return;

    await fetch(buildAgentCoreApiUrl("/api/agent/approve"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        executionId,
        stepId: approvalRequest.stepId,
        approved,
        feedback,
      }),
    });

    setState((s) => ({ ...s, status: "running", approvalRequest: null }));
  }, [state]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((s) => ({ ...s, status: "done" }));
  }, []);

  return { ...state, start, approve, stop };
}

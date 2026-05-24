"use client";

import { CheckCircle2, Circle, Loader2, XCircle, ShieldQuestion } from "lucide-react";

import { useMultiStepStream } from "@/hooks/useMultiStepStream";
import type { MultiStepStatus } from "@/hooks/useMultiStepStream";
import type { StepResult } from "@/lib/executor/contracts";

function StepIcon({ status }: { status: StepResult["status"] | "running" | "pending" }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-500" />;
    case "skipped":
      return <Circle className="w-4 h-4 text-gray-400" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    default:
      return <Circle className="w-4 h-4 text-gray-300" />;
  }
}

function StatusBadge({ status }: { status: MultiStepStatus }) {
  const map: Record<MultiStepStatus, { label: string; color: string }> = {
    idle: { label: "就绪", color: "bg-gray-100 text-gray-600" },
    connecting: { label: "连接中", color: "bg-yellow-100 text-yellow-700" },
    running: { label: "执行中", color: "bg-blue-100 text-blue-700" },
    awaiting_approval: { label: "等待审批", color: "bg-orange-100 text-orange-700" },
    done: { label: "完成", color: "bg-green-100 text-green-700" },
    error: { label: "错误", color: "bg-red-100 text-red-700" },
  };
  const { label, color } = map[status];
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{label}</span>;
}

export function MultiStepPanel() {
  const { status, plan, currentStepId, stepResults, approvalRequest, error, start, approve, stop } =
    useMultiStepStream();

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border border-gray-200 bg-white text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-800">多步执行</span>
        <StatusBadge status={status} />
      </div>

      {plan && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            步骤 ({stepResults.length}/{plan.totalSteps})
          </span>
          {plan.steps.map((step) => {
            const result = stepResults.find((r) => r.stepId === step.id);
            const isRunning = currentStepId === step.id;
            const stepStatus: StepResult["status"] | "running" | "pending" = result
              ? result.status
              : isRunning
                ? "running"
                : "pending";

            return (
              <div key={step.id} className="flex items-center gap-2 py-1">
                <StepIcon status={stepStatus} />
                <span className={`flex-1 ${stepStatus === "pending" ? "text-gray-400" : "text-gray-700"}`}>
                  {step.title}
                </span>
                {result?.durationMs ? (
                  <span className="text-xs text-gray-400">{(result.durationMs / 1000).toFixed(1)}s</span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {approvalRequest && (
        <div className="flex flex-col gap-2 p-3 rounded border border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2">
            <ShieldQuestion className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-orange-800">{approvalRequest.title}</span>
          </div>
          {approvalRequest.description && (
            <p className="text-xs text-orange-700">{approvalRequest.description}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => approve(true)}
              className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700"
            >
              批准
            </button>
            <button
              onClick={() => approve(false, "用户拒绝")}
              className="px-3 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
            >
              拒绝
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}

      {status === "running" && (
        <button
          onClick={stop}
          className="self-end px-3 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200"
        >
          停止
        </button>
      )}
    </div>
  );
}

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClawRuntimeConsoleAppWindow } from "@/components/apps/ClawRuntimeConsoleAppWindow";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="runtime-console-window">{children}</div>
  ),
}));

vi.mock("@/components/workflows/UnifiedAssetConsole", () => ({
  UnifiedAssetConsole: () => <div data-testid="unified-asset-console" />,
}));

vi.mock("@/hooks/useRuntimeDoctorReport", () => ({
  useRuntimeDoctorReport: () => ({
    report: null,
    loading: false,
    error: "",
    refresh: vi.fn(),
  }),
}));

vi.mock("@/hooks/useServerBackedSyncStatuses", () => ({
  useServerBackedSyncStatuses: () => [],
}));

vi.mock("@/hooks/useRuntimeSidecar", () => ({
  useRuntimeSidecar: () => ({
    status: { running: false, synced: true, lastAction: { message: "" } },
    loading: false,
    actionLoading: null,
    error: "",
    refresh: vi.fn(),
    sync: vi.fn(async () => ({ ok: true, message: "synced" })),
    boot: vi.fn(async () => ({ ok: true, message: "started" })),
    stop: vi.fn(async () => ({ ok: true, message: "stopped" })),
  }),
}));

vi.mock("@/lib/desktop-runtime", () => ({
  getDesktopRuntimeStatusSummary: () => ({
    profileMeta: { title: "Runtime", desc: "Runtime ready" },
    orchestrationMeta: { title: "Controlled", desc: "Controlled runtime" },
    initializationComplete: true,
    completedSteps: 1,
    totalSteps: 1,
    providerConfigured: true,
    shell: "browser",
    checklist: [],
  }),
  getRuntimeBridgeConfig: () => ({}),
}));

vi.mock("@/lib/settings", () => ({
  loadSettings: () => ({
    openclaw: { baseUrl: "" },
    personalization: { interfaceLanguage: "zh-CN" },
    runtime: {
      localRuntimeUrl: "",
      profile: "desktop_light",
      shell: "browser",
      sidecarApiUrl: "",
    },
  }),
}));

vi.mock("@/lib/runtime-events", () => ({
  RuntimeEventNames: { settings: "settings" },
  addRuntimeEventListener: () => () => undefined,
}));

vi.mock("@/lib/asset-jumps", () => ({
  jumpToAssetTarget: vi.fn(),
}));

vi.mock("@/lib/ui-events", () => ({
  requestOpenDealDesk: vi.fn(),
  requestOpenKnowledgeVault: vi.fn(),
  requestOpenSettings: vi.fn(),
}));

function buildRetryableFailedRun(): ControlledExecutionRunRecord {
  return {
    id: "run-retry-1",
    requestId: "request-1",
    sessionId: "session-1",
    workflowRunId: "workflow-1",
    scenarioId: "scenario-sales",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-1",
    state: "failed",
    currentStepId: "qualify",
    createdAt: 1,
    updatedAt: 2,
    error: "Qualification failed",
    auditEvents: [],
    plan: {
      id: "plan-1",
      goal: "Sales qualification",
      requiresApproval: false,
      totalSteps: 1,
      steps: [
        {
          id: "qualify",
          title: "Qualify lead",
          description: "Qualify lead",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
          onFailure: { action: "retry", maxRetries: 1 },
        },
      ],
    },
    steps: [
      {
        stepId: "qualify",
        state: "failed",
        startedAt: 1,
        finishedAt: 2,
        input: {},
        output: null,
        error: "Temporary provider failure",
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [],
      },
    ],
  };
}

describe("ClawRuntimeConsoleAppWindow controlled run recovery", () => {
  it("posts retry requests for eligible failed controlled runs", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs")) {
        return Response.json({ ok: true, data: { runs: [buildRetryableFailedRun()] } });
      }
      if (href.endsWith("/api/runtime/executor/sessions")) {
        return Response.json({ ok: true, data: { sessions: [] } });
      }
      if (
        href.endsWith(
          "/api/runtime/executor/controlled-runs/run-retry-1/retry",
        )
      ) {
        return Response.json({
          ok: true,
          data: { runId: "run-retry-1", state: "completed", retriedStepIds: ["qualify"] },
        });
      }
      return Response.json({ ok: true, data: {} });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ClawRuntimeConsoleAppWindow
        state="open"
        zIndex={1}
        active
        onFocus={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Sales qualification").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("qualify").length).toBeGreaterThan(0);

    const retryButton = await screen.findByRole("button", { name: "重试失败步骤" });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/runtime/executor/controlled-runs/run-retry-1/retry",
        { method: "POST" },
      );
    });
  });
});

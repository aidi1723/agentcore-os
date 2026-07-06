import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClawRuntimeConsoleAppWindow } from "@/components/apps/ClawRuntimeConsoleAppWindow";
import type { ControlledExecutionRunRecord } from "@/lib/executor/runtime/types";
import {
  requestOpenDealDesk,
  requestOpenIndustryHub,
  requestOpenKnowledgeVault,
  requestOpenPublisher,
  requestOpenSupportCopilot,
} from "@/lib/ui-events";

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
  requestOpenIndustryHub: vi.fn(),
  requestOpenKnowledgeVault: vi.fn(),
  requestOpenPublisher: vi.fn(),
  requestOpenSupportCopilot: vi.fn(),
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

function buildCompletedRunWithAssetLandings(): ControlledExecutionRunRecord {
  return {
    id: "run-assets-1",
    requestId: "request-assets-1",
    sessionId: "session-assets-1",
    workflowRunId: "workflow-assets-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-assets-1",
    state: "completed",
    currentStepId: "writeback",
    createdAt: 1,
    updatedAt: 2,
    finishedAt: 2,
    auditEvents: [],
    plan: {
      id: "plan-assets-1",
      goal: "Asset landing run",
      requiresApproval: false,
      totalSteps: 1,
      steps: [
        {
          id: "writeback",
          title: "Write assets",
          description: "Write controlled assets",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
        },
      ],
    },
    steps: [
      {
        stepId: "writeback",
        state: "completed",
        startedAt: 1,
        finishedAt: 2,
        input: {},
        output: {},
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary: "Wrote sales asset sales-asset-1",
            writtenAt: 2,
            assetId: "sales-asset-1",
            sourceKey: "controlled-run:run-assets-1:sales_asset",
            workflowRunId: "workflow-assets-1",
          },
          {
            target: "knowledge_asset",
            ok: true,
            summary: "Wrote knowledge asset knowledge-asset-1",
            writtenAt: 2,
            assetId: "knowledge-asset-1",
            sourceKey: "controlled-run:run-assets-1:knowledge_asset",
            workflowRunId: "workflow-assets-1",
          },
          {
            target: "workflow_run",
            ok: true,
            summary: "Wrote workflow run workflow-assets-1 as completed",
            writtenAt: 2,
            sourceKey: "controlled-run:run-assets-1:workflow_run",
            workflowRunId: "workflow-assets-1",
          },
          {
            target: "draft",
            ok: true,
            summary: "Wrote draft controlled-draft:workflow-assets-1",
            writtenAt: 2,
            assetId: "controlled-draft:workflow-assets-1",
            sourceKey: "controlled-run:run-assets-1:draft",
            workflowRunId: "workflow-assets-1",
          },
          {
            target: "support_asset",
            ok: true,
            summary: "Wrote support asset controlled-support-asset:workflow-assets-1",
            writtenAt: 2,
            assetId: "controlled-support-asset:workflow-assets-1",
            sourceKey: "controlled-run:run-assets-1:support_asset",
            workflowRunId: "workflow-assets-1",
          },
        ],
      },
    ],
  };
}

function buildCompletedRunWithLegacySalesLanding(): ControlledExecutionRunRecord {
  return {
    id: "run-legacy-sales-1",
    requestId: "request-legacy-sales-1",
    sessionId: "session-legacy-sales-1",
    workflowRunId: "workflow-legacy-sales-1",
    scenarioId: "sales-pipeline",
    playbookId: "sales-pipeline-v1",
    playbookVersion: "1.0.0",
    planId: "plan-legacy-sales-1",
    state: "completed",
    currentStepId: "writeback",
    createdAt: 1,
    updatedAt: 2,
    finishedAt: 2,
    auditEvents: [],
    plan: {
      id: "plan-legacy-sales-1",
      goal: "Legacy sales landing run",
      requiresApproval: false,
      totalSteps: 1,
      steps: [
        {
          id: "writeback",
          title: "Write legacy sales asset",
          description: "Write legacy controlled assets",
          toolCalls: [],
          dependsOn: [],
          mode: "auto",
        },
      ],
    },
    steps: [
      {
        stepId: "writeback",
        state: "completed",
        startedAt: 1,
        finishedAt: 2,
        input: {},
        output: {},
        attempts: 1,
        toolCallResults: [],
        writebackReceipts: [
          {
            target: "sales_asset",
            ok: true,
            summary: "Legacy sales asset receipt without structured metadata",
            writtenAt: 2,
          },
        ],
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

  it("passes record focus metadata when opening controlled run asset landings", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs")) {
        return Response.json({
          ok: true,
          data: { runs: [buildCompletedRunWithAssetLandings()] },
        });
      }
      if (href.endsWith("/api/runtime/executor/sessions")) {
        return Response.json({ ok: true, data: { sessions: [] } });
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
      expect(screen.getAllByText("Asset landing run").length).toBeGreaterThan(0);
    });

    const openButtons = await screen.findAllByRole("button", { name: "打开" });
    expect(openButtons).toHaveLength(5);
    fireEvent.click(openButtons[0]);
    fireEvent.click(openButtons[1]);

    expect(requestOpenDealDesk).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "sales-asset-1",
        sourceKey: "controlled-run:run-assets-1:sales_asset",
        workflowRunId: "workflow-assets-1",
        workflowScenarioId: "sales-pipeline",
      }),
    );
    expect(requestOpenKnowledgeVault).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: "knowledge-asset-1",
        sourceKey: "controlled-run:run-assets-1:knowledge_asset",
        workflowRunId: "workflow-assets-1",
        query: "knowledge-asset-1",
      }),
    );
  });

  it("opens workflow run and draft landings with focused prefill", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs")) {
        return Response.json({
          ok: true,
          data: { runs: [buildCompletedRunWithAssetLandings()] },
        });
      }
      if (href.endsWith("/api/runtime/executor/sessions")) {
        return Response.json({ ok: true, data: { sessions: [] } });
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
      expect(screen.getAllByText("Asset landing run").length).toBeGreaterThan(0);
    });

    const openButtons = await screen.findAllByRole("button", { name: "打开" });
    expect(openButtons).toHaveLength(5);
    fireEvent.click(openButtons[2]);
    fireEvent.click(openButtons[3]);

    expect(requestOpenIndustryHub).toHaveBeenCalledWith({
      workflowRunId: "workflow-assets-1",
      scenarioId: "sales-pipeline",
    });
    expect(requestOpenPublisher).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: "controlled-draft:workflow-assets-1",
        workflowRunId: "workflow-assets-1",
        workflowScenarioId: "sales-pipeline",
        workflowSource: "Runtime Console asset controlled-draft:workflow-assets-1",
        workflowNextStep:
          "Review the controlled run draft and decide whether to publish or revise.",
      }),
    );
  });

  it("opens support asset landings with support workflow context", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs")) {
        return Response.json({
          ok: true,
          data: { runs: [buildCompletedRunWithAssetLandings()] },
        });
      }
      if (href.endsWith("/api/runtime/executor/sessions")) {
        return Response.json({ ok: true, data: { sessions: [] } });
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
      expect(screen.getAllByText("Asset landing run").length).toBeGreaterThan(0);
    });

    const openButtons = await screen.findAllByRole("button", { name: "打开" });
    expect(openButtons).toHaveLength(5);
    fireEvent.click(openButtons[4]);

    expect(requestOpenSupportCopilot).toHaveBeenCalledWith({
      assetId: "controlled-support-asset:workflow-assets-1",
      sourceKey: "controlled-run:run-assets-1:support_asset",
      workflowRunId: "workflow-assets-1",
      workflowScenarioId: "sales-pipeline",
      workflowSource: "Runtime Console asset controlled-support-asset:workflow-assets-1",
      workflowNextStep:
        "Review the controlled run support asset and continue support resolution.",
    });
  });

  it("keeps legacy sales asset landings on broad Deal Desk fallback", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs")) {
        return Response.json({
          ok: true,
          data: { runs: [buildCompletedRunWithLegacySalesLanding()] },
        });
      }
      if (href.endsWith("/api/runtime/executor/sessions")) {
        return Response.json({ ok: true, data: { sessions: [] } });
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
      expect(screen.getAllByText("Legacy sales landing run").length).toBeGreaterThan(0);
    });

    fireEvent.click(await screen.findByRole("button", { name: "打开" }));

    const prefill = vi.mocked(requestOpenDealDesk).mock.calls.at(-1)?.[0];
    expect(prefill).toEqual(
      expect.objectContaining({
        workflowScenarioId: "sales-pipeline",
        workflowSource: "Runtime Console asset sales_asset",
      }),
    );
    expect(prefill).not.toHaveProperty("assetId");
    expect(prefill).not.toHaveProperty("sourceKey");
    expect(prefill).not.toHaveProperty("workflowRunId");
  });

  it("copies governed trace artifacts from the selected controlled run", async () => {
    const clipboardWrite = vi.fn(async () => undefined);
    vi.stubGlobal("navigator", {
      clipboard: {
        writeText: clipboardWrite,
      },
    });

    const run = buildCompletedRunWithAssetLandings();
    run.steps[0].input = {
      customer: "Nora",
      secret: "sk-console-secret",
    };
    run.steps[0].output = {
      draft: "Email Nora at nora@example.com",
    };

    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs")) {
        return Response.json({
          ok: true,
          data: { runs: [run] },
        });
      }
      if (
        href.endsWith(
          "/api/runtime/executor/controlled-runs/run-assets-1/trace-artifact",
        )
      ) {
        return Response.json({
          ok: true,
          data: {
            export: {
              filename: "controlled-trace-run-assets-1-123.json",
              generatedAt: 123,
              contentType: "application/json",
              governanceMode: "fixture",
            },
            artifact: {
              id: "run-assets-1",
              playbookId: "sales-pipeline-v1",
              steps: [
                {
                  stepId: "writeback",
                  input: { redacted: true, reason: "trace_governance" },
                  output: { redacted: true, reason: "trace_governance" },
                },
              ],
            },
          },
        });
      }
      if (href.endsWith("/api/runtime/executor/sessions")) {
        return Response.json({ ok: true, data: { sessions: [] } });
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
      expect(screen.getAllByText("Asset landing run").length).toBeGreaterThan(0);
    });

    fireEvent.click(await screen.findByRole("button", { name: "复制脱敏 Trace" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/runtime/executor/controlled-runs/run-assets-1/trace-artifact",
        { method: "GET", cache: "no-store" },
      );
      expect(clipboardWrite).toHaveBeenCalled();
    });

    const copiedText = clipboardWrite.mock.calls[0]?.[0] as string;
    expect(copiedText).toContain('"artifact"');
    expect(copiedText).toContain("run-assets-1");
    expect(copiedText).not.toContain("Nora");
    expect(copiedText).not.toContain("sk-console-secret");
    expect(copiedText).not.toContain("nora@example.com");
  });
});

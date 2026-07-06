import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IndustryHubAppWindow } from "@/components/apps/IndustryHubAppWindow";
import { getWorkspaceScenario } from "@/lib/workspace-presets";
import { getWorkflowRun, startWorkflowRun } from "@/lib/workflow-runs";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="industry-hub-window">{children}</div>
  ),
}));

vi.mock("@/components/AppToast", () => ({
  AppToast: () => null,
}));

vi.mock("@/lib/settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/settings")>();
  return {
    ...actual,
    loadSettings: () => actual.defaultSettings,
    saveSettings: vi.fn(),
  };
});

vi.mock("@/lib/ui-events", () => ({
  requestOpenApp: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
});

describe("IndustryHubAppWindow workflow focus prefill", () => {
  it("selects the role desk for an existing workflow run from prefill", async () => {
    const salesScenario = getWorkspaceScenario("sales-pipeline");
    expect(salesScenario).not.toBeNull();
    const runId = startWorkflowRun(salesScenario!, "manual");
    expect(getWorkflowRun(runId)?.scenarioId).toBe("sales-pipeline");

    render(
      <IndustryHubAppWindow
        state="open"
        zIndex={1}
        active
        onFocus={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Creator Desk")).toBeInTheDocument();

    fireEvent(
      window,
      new CustomEvent("openclaw:industry-hub-prefill", {
        detail: { workflowRunId: runId, scenarioId: "sales-pipeline" },
      }),
    );

    await waitFor(() => {
      expect(screen.getByText("Sales Desk")).toBeInTheDocument();
      expect(screen.getByText(/当前运行流：/)).toHaveTextContent("Sales Pipeline Desk");
    });
  });
});

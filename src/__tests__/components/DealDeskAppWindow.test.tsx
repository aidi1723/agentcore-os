import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealDeskAppWindow } from "@/components/apps/DealDeskAppWindow";
import { createDeal, getDeals } from "@/lib/deals";
import { upsertSalesAsset } from "@/lib/sales-assets";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="deal-desk-window">{children}</div>
  ),
}));

vi.mock("@/components/workflows/SalesHeroWorkflowPanel", () => ({
  SalesHeroWorkflowPanel: () => <div data-testid="sales-workflow-panel" />,
}));

vi.mock("@/components/recommendations/RecommendationResultBody", () => ({
  RecommendationResultBody: () => <div data-testid="recommendation-result" />,
}));

vi.mock("@/lib/openclaw-agent-client", () => ({
  requestOpenClawAgent: vi.fn(),
  requestRealityCheck: vi.fn(),
}));

vi.mock("@/lib/ui-events", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/ui-events")>("@/lib/ui-events");
  return { ...actual, requestComposeEmail: vi.fn() };
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ok: true, data: {} })));
});

describe("DealDeskAppWindow record-level asset focus", () => {
  it("selects the existing deal for a sales asset prefill without creating a new lead", async () => {
    const dealId = createDeal({
      company: "Focused Facades",
      contact: "Nora",
      workflowRunId: "workflow-focus-1",
      workflowScenarioId: "sales-pipeline",
    });
    const asset = upsertSalesAsset("workflow-focus-1", {
      scenarioId: "sales-pipeline",
      dealId,
      company: "Focused Facades",
      contactName: "Nora",
      requirementSummary: "Approved quote context",
    });
    createDeal({
      company: "Other Lead",
      contact: "Ada",
      workflowRunId: "workflow-other-1",
      workflowScenarioId: "sales-pipeline",
    });

    render(
      <DealDeskAppWindow
        state="open"
        zIndex={1}
        active
        onFocus={vi.fn()}
        onMinimize={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Other Lead")).toBeInTheDocument();
    });

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openclaw:deal-desk-prefill", {
          detail: {
            assetId: asset.id,
            workflowRunId: "workflow-focus-1",
            workflowSource: "Runtime Console asset",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Focused Facades")).toBeInTheDocument();
    });
    expect(getDeals()).toHaveLength(2);
  });
});

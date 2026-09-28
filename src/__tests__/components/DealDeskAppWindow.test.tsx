import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealDeskAppWindow } from "@/components/apps/DealDeskAppWindow";
import { createDeal, getDeals } from "@/lib/deals";
import { getSalesAssets, upsertSalesAsset } from "@/lib/sales-assets";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="deal-desk-window">{children}</div>
  ),
}));

vi.mock("@/components/workflows/SalesHeroWorkflowPanel", () => ({
  SalesHeroWorkflowPanel: ({
    actions,
  }: {
    actions?: Array<{ label: string; onClick: () => void; disabled?: boolean }>;
  }) => (
    <div data-testid="sales-workflow-panel">
      {actions?.map((action) => (
        <button key={action.label} type="button" disabled={action.disabled} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
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

  it("retries record focus when sales asset metadata arrives after prefill", async () => {
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

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openclaw:deal-desk-prefill", {
          detail: {
            workflowRunId: "workflow-late-focus",
            workflowSource: "Runtime Console asset",
          },
        }),
      );
    });

    act(() => {
      createDeal({
        company: "Other Lead",
        contact: "Ada",
        workflowRunId: "workflow-other-late",
        workflowScenarioId: "sales-pipeline",
      });
    });
    await waitFor(() => {
      expect(screen.getByDisplayValue("Other Lead")).toBeInTheDocument();
    });
    expect(screen.getByText("同步后仍未找到对应线索")).toBeInTheDocument();

    let targetDealId = "";
    act(() => {
      targetDealId = createDeal({
        company: "Late Focus Facades",
        contact: "Nora",
        workflowRunId: "workflow-late-focus",
        workflowScenarioId: "sales-pipeline",
      });
      upsertSalesAsset("workflow-late-focus", {
        scenarioId: "sales-pipeline",
        dealId: targetDealId,
        company: "Late Focus Facades",
        contactName: "Nora",
        requirementSummary: "Server-hydrated sales asset",
      });
    });

    await waitFor(() => {
      expect(screen.getByDisplayValue("Late Focus Facades")).toBeInTheDocument();
    });
    expect(getDeals()).toHaveLength(2);
  });

  it("starts a controlled sales run and does not write a sales asset", async () => {
    createDeal({ company: "Example Co", contact: "Demo Contact" });
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/runtime/executor/controlled-runs") && init?.method === "POST") {
        return Response.json({
          ok: true,
          data: { run: { id: "demo-deal-1", currentStepId: "human_review" } },
        });
      }
      return Response.json({ ok: true, data: {} });
    });
    vi.stubGlobal("fetch", fetchMock);

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

    fireEvent.click(await screen.findByRole("button", { name: /Example Co/ }));
    fireEvent.click(await screen.findByRole("button", { name: "启动受控销售运行" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/runtime/executor/controlled-runs",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ playbookId: "sales-pipeline-v1" }),
        }),
      );
    });
    expect(getSalesAssets()).toHaveLength(0);
    expect(getDeals().find((deal) => deal.company === "Example Co")?.workflowRunId).toBe("demo-deal-1");
  });

  it("does not write a sales asset when generating a brief or opening email", async () => {
    createDeal({ company: "Brief Co", contact: "Ada", need: "需要报价" });

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

    fireEvent.click(await screen.findByRole("button", { name: /Brief Co/ }));
    fireEvent.click(screen.getByRole("button", { name: "生成简报" }));
    await waitFor(() => {
      expect(getDeals().find((deal) => deal.company === "Brief Co")?.brief.length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole("button", { name: "转到 Email Assistant" }));

    expect(getSalesAssets()).toHaveLength(0);
    expect(getDeals().find((deal) => deal.company === "Brief Co")?.workflowRunId).toBeUndefined();
  });
});

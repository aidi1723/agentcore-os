import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupportCopilotAppWindow } from "@/components/apps/SupportCopilotAppWindow";
import { createSupportTicket, getSupportTickets } from "@/lib/support";
import { upsertSupportAsset } from "@/lib/support-assets";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="support-copilot-window">{children}</div>
  ),
}));

vi.mock("@/components/workflows/SupportHeroWorkflowPanel", () => ({
  SupportHeroWorkflowPanel: () => <div data-testid="support-workflow-panel" />,
}));

vi.mock("@/components/recommendations/RecommendationResultBody", () => ({
  RecommendationResultBody: () => <div data-testid="recommendation-result" />,
}));

vi.mock("@/lib/openclaw-agent-client", () => ({
  requestOpenClawAgent: vi.fn(),
  requestRealityCheck: vi.fn(),
}));

vi.mock("@/lib/ui-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ui-events")>("@/lib/ui-events");
  return {
    ...actual,
    requestOpenCrm: vi.fn(),
    requestOpenKnowledgeVault: vi.fn(),
  };
});

function renderSupportCopilot() {
  return render(
    <SupportCopilotAppWindow
      state="open"
      zIndex={1}
      active
      onFocus={vi.fn()}
      onMinimize={vi.fn()}
      onClose={vi.fn()}
    />,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: {} })),
  );
});

describe("SupportCopilotAppWindow record focus", () => {
  it("focuses an existing ticket from support asset metadata without creating a duplicate", async () => {
    const targetTicketId = createSupportTicket({
      customer: "Target Customer",
      subject: "Target warranty issue",
      workflowRunId: "workflow-support-1",
    });
    const firstTicketId = createSupportTicket({
      customer: "First Customer",
      subject: "First ticket",
      workflowRunId: "workflow-first",
    });
    const asset = upsertSupportAsset("workflow-support-1", {
      sourceKey: "controlled-run:run-1:support_asset",
      scenarioId: "support-ops",
      ticketId: targetTicketId,
      customer: "Target Customer",
      channel: "email",
      issueSummary: "Target issue",
    });

    renderSupportCopilot();

    await screen.findByDisplayValue("First Customer");

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openclaw:support-copilot-prefill", {
          detail: {
            assetId: asset.id,
            sourceKey: "controlled-run:run-1:support_asset",
            workflowRunId: "workflow-support-1",
          },
        }),
      );
    });

    await screen.findByDisplayValue("Target Customer");
    expect(getSupportTickets()).toHaveLength(2);
    expect(getSupportTickets().map((ticket) => ticket.id)).toEqual(
      expect.arrayContaining([firstTicketId, targetTicketId]),
    );
  });

  it("keeps broad support prefill creating a new ticket", async () => {
    renderSupportCopilot();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openclaw:support-copilot-prefill", {
          detail: {
            customer: "Broad Customer",
            channel: "email",
            subject: "Broad handoff",
            message: "Please help with this issue.",
            status: "new",
          },
        }),
      );
    });

    await screen.findByDisplayValue("Broad Customer");
    expect(screen.getByDisplayValue("Broad handoff")).toBeInTheDocument();
    expect(getSupportTickets()).toHaveLength(1);
  });

  it("keeps support record focus pending until asset and ticket stores update", async () => {
    renderSupportCopilot();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openclaw:support-copilot-prefill", {
          detail: {
            assetId: "support-asset-pending",
            sourceKey: "controlled-run:run-pending:support_asset",
            workflowRunId: "workflow-pending",
          },
        }),
      );
    });

    expect(getSupportTickets()).toHaveLength(0);
    expect(screen.queryByText("未找到对应客服工单")).not.toBeInTheDocument();

    act(() => {
      const ticketId = createSupportTicket({
        customer: "Hydrated Customer",
        subject: "Hydrated issue",
        workflowRunId: "workflow-pending",
      });
      upsertSupportAsset("workflow-pending", {
        sourceKey: "controlled-run:run-pending:support_asset",
        scenarioId: "support-ops",
        ticketId,
        customer: "Hydrated Customer",
        channel: "email",
        issueSummary: "Hydrated issue",
      });
    });

    await screen.findByDisplayValue("Hydrated Customer");
    expect(getSupportTickets()).toHaveLength(1);
  });

  it("does not create a synthetic ticket when an exact support record stays missing", async () => {
    renderSupportCopilot();

    act(() => {
      window.dispatchEvent(
        new CustomEvent("openclaw:support-copilot-prefill", {
          detail: {
            assetId: "missing-support-asset",
            sourceKey: "controlled-run:run-missing:support_asset",
            workflowRunId: "workflow-missing",
          },
        }),
      );
    });

    expect(screen.queryByText("未找到对应客服工单")).not.toBeInTheDocument();

    act(() => {
      window.dispatchEvent(new Event("storage"));
    });

    await screen.findByText("未找到对应客服工单");
    expect(getSupportTickets()).toHaveLength(0);
  });
});

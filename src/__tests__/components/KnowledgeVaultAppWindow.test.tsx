import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KnowledgeVaultAppWindow } from "@/components/apps/KnowledgeVaultAppWindow";
import { upsertKnowledgeAsset } from "@/lib/knowledge-assets";

vi.mock("@/components/windows/AppWindowShell", () => ({
  AppWindowShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="knowledge-vault-window">{children}</div>
  ),
}));

vi.mock("@/components/recommendations/RecommendationResultBody", () => ({
  RecommendationResultBody: () => <div data-testid="recommendation-result" />,
}));

vi.mock("@/components/workflows/useRuntimeHeroWorkflowSummary", () => ({
  useRuntimeHeroWorkflowSummary: () => ({
    recommendations: {},
    phase: "idle",
    error: "",
    syncedAt: null,
    refresh: vi.fn(),
    refreshKey: "test",
  }),
}));

vi.mock("@/lib/asset-jumps", () => ({ jumpToAssetTarget: vi.fn() }));

vi.mock("@/lib/ui-events", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ui-events")>("@/lib/ui-events");
  return {
    ...actual,
    requestOpenDealDesk: vi.fn(),
    requestOpenSupportCopilot: vi.fn(),
  };
});

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: { creatorAssets: [] } })),
  );
});

describe("KnowledgeVaultAppWindow record-level asset focus", () => {
  it("focuses a knowledge asset from prefill metadata", async () => {
    const asset = upsertKnowledgeAsset("controlled-run:run-1:knowledge_asset", {
      title: "Focused knowledge asset",
      body: "Approved controlled run learning.",
      sourceApp: "personal_crm",
      scenarioId: "sales-pipeline",
      workflowRunId: "workflow-focus-1",
      assetType: "sales_playbook",
      status: "active",
      tags: ["sales"],
      applicableScene: "Door and window inquiry",
    });

    render(
      <KnowledgeVaultAppWindow
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
        new CustomEvent("openclaw:vault-prefill", {
          detail: {
            assetId: asset.id,
            sourceKey: asset.sourceKey,
            workflowRunId: "workflow-focus-1",
          },
        }),
      );
    });

    await waitFor(() => {
      expect(screen.getByPlaceholderText("搜索流程资产...")).toHaveValue("Focused knowledge asset");
    });
    expect(screen.getByText("已聚焦")).toBeInTheDocument();
  });
});

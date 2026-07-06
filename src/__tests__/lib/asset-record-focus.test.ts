import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getSalesAssetById,
  getSalesAssetByWorkflowRunId,
  upsertSalesAsset,
} from "@/lib/sales-assets";
import {
  getKnowledgeAssetById,
  getKnowledgeAssetBySourceKey,
  upsertKnowledgeAsset,
} from "@/lib/knowledge-assets";
import {
  getSupportAssetById,
  getSupportAssetBySourceKey,
  getSupportAssetForFocus,
  upsertSupportAsset,
} from "@/lib/support-assets";

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ ok: true, data: {} })),
  );
});

describe("record-level asset lookup helpers", () => {
  it("finds a sales asset by id", () => {
    const asset = upsertSalesAsset("workflow-sales-1", {
      scenarioId: "sales-pipeline",
      dealId: "deal-1",
      company: "Aperture Facades",
      contactName: "Nora",
      requirementSummary: "Curtain wall quote",
    });

    expect(getSalesAssetById(asset.id)?.workflowRunId).toBe("workflow-sales-1");
    expect(getSalesAssetByWorkflowRunId("workflow-sales-1")?.id).toBe(asset.id);
    expect(getSalesAssetById("missing")).toBeNull();
  });

  it("finds a knowledge asset by id and source key", () => {
    const asset = upsertKnowledgeAsset("controlled-run:run-1:knowledge_asset", {
      title: "Sales follow-up pattern",
      body: "Use approved lead context before drafting.",
      sourceApp: "personal_crm",
      scenarioId: "sales-pipeline",
      workflowRunId: "workflow-sales-1",
      assetType: "sales_playbook",
      status: "active",
      tags: ["sales"],
      applicableScene: "Door and window inquiry",
    });

    expect(getKnowledgeAssetById(asset.id)?.sourceKey).toBe(
      "controlled-run:run-1:knowledge_asset",
    );
    expect(getKnowledgeAssetBySourceKey("controlled-run:run-1:knowledge_asset")?.id).toBe(
      asset.id,
    );
    expect(getKnowledgeAssetById("missing")).toBeNull();
    expect(getKnowledgeAssetBySourceKey("missing")).toBeNull();
  });

  it("finds a support asset by id, source key, and workflow fallback", () => {
    const asset = upsertSupportAsset("workflow-support-1", {
      sourceKey: "controlled-run:run-1:support_asset",
      scenarioId: "support-ops",
      ticketId: "ticket-1",
      customer: "Nora",
      channel: "email",
      issueSummary: "Warranty question",
    });

    expect(getSupportAssetById(asset.id)?.workflowRunId).toBe("workflow-support-1");
    expect(getSupportAssetBySourceKey("controlled-run:run-1:support_asset")?.id).toBe(
      asset.id,
    );
    expect(getSupportAssetForFocus({ assetId: asset.id })?.id).toBe(asset.id);
    expect(
      getSupportAssetForFocus({
        sourceKey: "controlled-run:run-1:support_asset",
        workflowRunId: "workflow-support-1",
      })?.id,
    ).toBe(asset.id);
    expect(getSupportAssetForFocus({ workflowRunId: "workflow-support-1" })?.id).toBe(
      asset.id,
    );
    expect(getSupportAssetById("missing")).toBeNull();
    expect(getSupportAssetBySourceKey("missing")).toBeNull();
    expect(getSupportAssetForFocus({ assetId: "missing" })).toBeNull();
  });
});

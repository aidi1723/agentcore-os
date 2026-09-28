import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { POST as createJob } from "@/app/api/publish/jobs/route";
import { POST as approveDraftRoute } from "@/app/api/runtime/state/drafts/[draftId]/approve/route";
import { PENDING_REVIEW_PUBLISH_ERROR, draftPublishBlock } from "@/lib/drafts";
import { listDraftStoreSnapshot, upsertDraftInStore } from "@/lib/server/draft-store";
import { listPublishJobs } from "@/lib/server/publish-job-store";

let tmpDir: string;
let originalCwd: () => string;

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), "draft-pending-review-"));
  originalCwd = process.cwd;
  process.cwd = () => tmpDir;
  const jsonStore = await import("@/lib/server/json-store");
  jsonStore.invalidateCache();
});

afterEach(async () => {
  process.cwd = originalCwd;
  await rm(tmpDir, { recursive: true, force: true });
});

function draft(approvalState?: "pending_review" | "approved") {
  return {
    id: "draft-1",
    title: "待复核跟进",
    body: "还不能外发",
    source: "publisher" as const,
    approvalState,
    createdAt: 1,
    updatedAt: 2,
  };
}

describe("pending review drafts", () => {
  it("blocks only pending review drafts from publishing", () => {
    expect(draftPublishBlock(draft("pending_review"))).toBe(PENDING_REVIEW_PUBLISH_ERROR);
    expect(draftPublishBlock(draft())).toBeNull();
    expect(draftPublishBlock(null)).toBeNull();
  });

  it("does not let a pending review draft become approved", async () => {
    await upsertDraftInStore(draft("pending_review"));
    const updated = await upsertDraftInStore({
      ...draft("approved"),
      title: "改过标题",
      updatedAt: 3,
    });

    expect(updated.draft).toMatchObject({
      title: "改过标题",
      approvalState: "pending_review",
    });
    expect((await listDraftStoreSnapshot()).drafts[0]?.approvalState).toBe("pending_review");
  });

  it("does not store a newly created draft as approved", async () => {
    const stored = await upsertDraftInStore(draft("approved"));
    expect(stored.draft?.approvalState).toBeUndefined();
  });

  it("rejects a publish job for a pending review draft", async () => {
    await upsertDraftInStore(draft("pending_review"));
    const response = await createJob(
      new Request("http://127.0.0.1/api/publish/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftId: "draft-1",
          draftTitle: "待复核跟进",
          draftBody: "还不能外发",
          platforms: ["wechat"],
          mode: "dispatch",
          status: "queued",
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: PENDING_REVIEW_PUBLISH_ERROR,
    });
    expect(await listPublishJobs()).toHaveLength(0);
  });

  it("still queues a draft that is not pending review", async () => {
    await upsertDraftInStore(draft());
    const response = await createJob(
      new Request("http://127.0.0.1/api/publish/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftId: "draft-1",
          draftTitle: "普通草稿",
          platforms: ["wechat"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await listPublishJobs()).toHaveLength(1);
  });

  it("approves a pending review draft and then allows it into the queue", async () => {
    await upsertDraftInStore(draft("pending_review"));
    const approval = await approveDraftRoute(
      new Request("http://127.0.0.1/api/runtime/state/drafts/draft-1/approve", { method: "POST" }),
      { params: Promise.resolve({ draftId: "draft-1" }) },
    );

    expect(approval.status).toBe(200);
    await expect(approval.json()).resolves.toMatchObject({
      ok: true,
      data: { draft: { id: "draft-1", approvalState: "approved" } },
    });

    const blocked = await upsertDraftInStore({
      ...draft("pending_review"),
      updatedAt: 4,
    });
    expect(blocked.draft?.approvalState).toBe("approved");

    const response = await createJob(
      new Request("http://127.0.0.1/api/publish/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftId: "draft-1",
          draftTitle: "待复核跟进",
          platforms: ["wechat"],
          mode: "dispatch",
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await listPublishJobs()).toHaveLength(1);
  });

  it("refuses to approve a draft that is not pending review", async () => {
    await upsertDraftInStore(draft());
    const response = await approveDraftRoute(
      new Request("http://127.0.0.1/api/runtime/state/drafts/draft-1/approve", { method: "POST" }),
      { params: Promise.resolve({ draftId: "draft-1" }) },
    );
    expect(response.status).toBe(409);
    expect((await listDraftStoreSnapshot()).drafts[0]?.approvalState).toBeUndefined();
  });
});

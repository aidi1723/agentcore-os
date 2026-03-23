import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

function moduleUrl(relativePath) {
  return pathToFileURL(path.join(PROJECT_ROOT, relativePath)).href;
}

class MemoryStorage {
  #store = new Map();

  getItem(key) {
    return this.#store.has(key) ? this.#store.get(key) : null;
  }

  setItem(key, value) {
    this.#store.set(String(key), String(value));
  }

  removeItem(key) {
    this.#store.delete(key);
  }

  clear() {
    this.#store.clear();
  }
}

function installBrowserStub() {
  const localStorage = new MemoryStorage();
  const eventTarget = new EventTarget();
  const windowStub = {
    localStorage,
    dispatchEvent: (event) => eventTarget.dispatchEvent(event),
    addEventListener: (...args) => eventTarget.addEventListener(...args),
    removeEventListener: (...args) => eventTarget.removeEventListener(...args),
  };
  globalThis.window = windowStub;
  globalThis.localStorage = localStorage;
  return localStorage;
}

function resetBrowserState(localStorage) {
  localStorage.clear();
}

function logSection(title) {
  console.log(`\n[workflow-regression] ${title}`);
}

async function runSalesAndKnowledgeRegression(localStorage) {
  logSection("sales + knowledge asset");
  resetBrowserState(localStorage);

  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const salesWorkflow = await import(moduleUrl("src/lib/sales-workflow.ts"));
  const deals = await import(moduleUrl("src/lib/deals.ts"));
  const knowledgeAssets = await import(moduleUrl("src/lib/knowledge-assets.ts"));
  const reuse = await import(moduleUrl("src/lib/knowledge-asset-reuse.ts"));

  const salesScenario = salesWorkflow.getSalesWorkflowScenario();
  assert(salesScenario, "Sales workflow scenario should exist.");

  const runId = workflowRuns.startWorkflowRun(salesScenario, "web_form");
  const dealId = deals.createDeal({
    company: "Aventra Windows",
    contact: "Lena",
    inquiryChannel: "WhatsApp",
    preferredLanguage: "English",
    productLine: "Thermal Aluminum Door",
    need: "Need a fast quote for UAE project",
    budget: "USD 25k",
    timing: "30 days",
    workflowRunId: runId,
    workflowScenarioId: salesScenario.id,
    workflowStageId: "qualify",
    workflowSource: "Regression sales lead intake",
    workflowNextStep: "Qualify and draft outreach",
    workflowTriggerType: "web_form",
  });

  deals.updateDeal(dealId, {
    stage: "qualified",
    brief: "Priority lead with clear delivery window.",
    reviewNotes: "Approved for outreach.",
  });

  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  const completedRun = workflowRuns.completeWorkflowRun(runId);
  assert.equal(completedRun?.state, "completed", "Sales workflow should complete.");

  const latestDeal = deals.getDeals()[0];
  assert.equal(latestDeal?.id, dealId, "Latest deal should match created lead.");
  assert.equal(latestDeal?.stage, "qualified", "Sales deal should preserve qualified stage.");
  assert.equal(latestDeal?.workflowRunId, runId, "Sales deal should keep workflow metadata.");

  const salesAsset = knowledgeAssets.upsertKnowledgeAsset(`sales-${runId}`, {
    title: "Aventra Windows · 跟进资产",
    body:
      "公司：Aventra Windows\n联系人：Lena\n来源：WhatsApp\n语言：English\n产品线：Thermal Aluminum Door\n预算：USD 25k\n时间：30 days\n\n【客户画像与偏好】\n偏好快节奏英文沟通\n\n【有效跟进策略】\n48 小时内给出价格框架和交期说明\n\n【下次可复用模板】\n先确认项目阶段，再发报价框架",
    sourceApp: "personal_crm",
    scenarioId: salesScenario.id,
    workflowRunId: runId,
    assetType: "sales_playbook",
    status: "active",
    tags: ["sales", "uae"],
    applicableScene: "门窗外贸报价推进",
  });

  const beforeReuse = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === salesAsset.id);
  assert.equal(beforeReuse?.reuseCount, 0, "New sales asset should start with zero reuse count.");

  const prefill = reuse.buildDealDeskPrefillFromKnowledgeAsset(salesAsset);
  const afterPrefill = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === salesAsset.id);
  assert.equal(afterPrefill?.reuseCount, 0, "Building a sales prefill should not mutate reuse count.");
  assert.equal(prefill.company, "Aventra Windows", "Sales prefill should parse company.");
  assert.equal(prefill.contact, "Lena", "Sales prefill should parse contact.");
  assert.match(prefill.workflowNextStep ?? "", /复用已沉淀销售打法/, "Sales prefill should include workflow next step.");

  knowledgeAssets.incrementKnowledgeAssetReuse(salesAsset.id);
  const afterIncrement = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === salesAsset.id);
  assert.equal(afterIncrement?.reuseCount, 1, "Explicit reuse increment should update reuse count.");

  console.log("sales workflow and sales asset regression passed");
}

async function runSupportAndKnowledgeRegression(localStorage) {
  logSection("support + knowledge asset");
  resetBrowserState(localStorage);

  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const supportWorkflow = await import(moduleUrl("src/lib/support-workflow.ts"));
  const support = await import(moduleUrl("src/lib/support.ts"));
  const knowledgeAssets = await import(moduleUrl("src/lib/knowledge-assets.ts"));
  const reuse = await import(moduleUrl("src/lib/knowledge-asset-reuse.ts"));

  const supportScenario = supportWorkflow.getSupportWorkflowScenario();
  assert(supportScenario, "Support workflow scenario should exist.");

  const runId = workflowRuns.startWorkflowRun(supportScenario, "manual");
  const ticketId = support.createSupportTicket({
    customer: "Nora",
    channel: "whatsapp",
    subject: "Broken hinge on delivery",
    message: "The hinge is damaged and customer requests replacement.",
    workflowRunId: runId,
    workflowScenarioId: supportScenario.id,
    workflowStageId: "capture",
    workflowSource: "Regression support intake",
    workflowNextStep: "Draft reply and define escalation boundary",
    workflowTriggerType: "manual",
  });

  support.updateSupportTicket(ticketId, {
    status: "waiting",
    replyDraft: "We will ship a replacement hinge within 48 hours.",
    reviewNotes: "Needs warranty boundary note.",
  });

  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  workflowRuns.advanceWorkflowRun(runId);
  const completedRun = workflowRuns.completeWorkflowRun(runId);
  assert.equal(completedRun?.state, "completed", "Support workflow should complete.");

  const latestTicket = support.getSupportTickets()[0];
  assert.equal(latestTicket?.id, ticketId, "Latest support ticket should match created ticket.");
  assert.equal(latestTicket?.status, "waiting", "Support ticket should preserve updated status.");
  assert.equal(latestTicket?.workflowRunId, runId, "Support ticket should keep workflow metadata.");

  const supportAsset = knowledgeAssets.upsertKnowledgeAsset(`support-${runId}`, {
    title: "Broken hinge after delivery · FAQ 资产",
    body:
      "客户：Nora\n渠道：WhatsApp\n主题：Broken hinge after delivery\n问题摘要：Damaged hinge after installation\n\n【标准回复】\nWe will ship a replacement hinge and share the tracking number.\n\n【升级边界】\nIf damage includes frame deformation, escalate to after-sales engineer.\n\n【需要补充的信息】\n需要订单号和现场图片",
    sourceApp: "support_copilot",
    scenarioId: supportScenario.id,
    workflowRunId: runId,
    assetType: "support_faq",
    status: "active",
    tags: ["support", "after-sales"],
    applicableScene: "售后五金损坏处理",
  });

  const prefill = reuse.buildSupportPrefillFromKnowledgeAsset(supportAsset);
  assert.equal(prefill.channel, "whatsapp", "Support prefill should parse channel.");
  assert.match(prefill.replyDraft ?? "", /replacement hinge/i, "Support prefill should parse reply draft.");
  assert.match(prefill.workflowNextStep ?? "", /已沉淀边界处理/, "Support prefill should include escalation guidance.");

  knowledgeAssets.setKnowledgeAssetStatus(supportAsset.id, "archived");
  const archivedAsset = knowledgeAssets.getKnowledgeAssets().find((asset) => asset.id === supportAsset.id);
  assert.equal(archivedAsset?.status, "archived", "Support asset should support archive transitions.");

  console.log("support workflow and FAQ asset regression passed");
}

async function runKnowledgeReuseSourceGuard() {
  logSection("knowledge vault source guard");
  const file = path.join(PROJECT_ROOT, "src", "components", "apps", "KnowledgeVaultAppWindow.tsx");
  const source = await readFile(file, "utf8");
  const anchor = source.indexOf("一键复用");
  assert(anchor >= 0, "Knowledge Vault one-click reuse button should exist.");
  const oneClickBlock = source.slice(Math.max(0, anchor - 500), anchor + 500);
  assert(!/incrementKnowledgeAssetReuse\(asset\.id\)/.test(oneClickBlock), "One-click reuse should not increment reuse count directly.");
  assert(/标记已复用/.test(source), "Explicit reuse marker button should remain available.");
  console.log("knowledge vault one-click reuse guard passed");
}

async function runPublishQueueRegression() {
  logSection("publish queue");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-publish-regression-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const publishJobStore = await import(moduleUrl("src/lib/server/publish-job-store.ts"));
    const publishConfigStore = await import(moduleUrl("src/lib/server/publish-config-store.ts"));
    const queueRunner = await import(moduleUrl("src/lib/server/publish-queue-runner.ts"));

    await publishConfigStore.writePublishConfig({});

    const dryRunJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Regression draft",
      draftBody: "Regression body for manual publishing",
      platforms: ["wechat", "xiaohongshu"],
      mode: "dry-run",
    });

    const dryRunResult = await queueRunner.runOneQueuedPublishJob();
    assert.equal(dryRunResult.ok, true, "Dry-run publish queue execution should succeed.");
    assert.equal(dryRunResult.processed, true, "Dry-run publish queue should process one job.");

    const jobsAfterDryRun = await publishJobStore.listPublishJobs();
    const finishedDryRun = jobsAfterDryRun.find((job) => job.id === dryRunJob.id);
    assert.equal(finishedDryRun?.status, "done", "Dry-run publish job should finish as done.");
    assert.ok(finishedDryRun?.resultText, "Dry-run publish job should store result text.");

    await publishConfigStore.writePublishConfig({
      xiaohongshu: {
        token: "regression-token",
        webhookUrl: "http://127.0.0.1:9/dispatch",
      },
    });

    const dispatchJob = await publishJobStore.createPublishJobRecord({
      draftTitle: "Dispatch retry regression",
      draftBody: "This should retry and then fail.",
      platforms: ["xiaohongshu"],
      mode: "dispatch",
      maxAttempts: 2,
    });

    const firstDispatch = await queueRunner.runOneQueuedPublishJob();
    assert.equal(firstDispatch.ok, false, "First dispatch attempt should fail.");
    assert.equal(firstDispatch.retried, true, "First dispatch attempt should schedule a retry.");

    await publishJobStore.updatePublishJobRecord(dispatchJob.id, {
      nextAttemptAt: Date.now() - 1000,
    });

    const secondDispatch = await queueRunner.runOneQueuedPublishJob();
    assert.equal(secondDispatch.ok, false, "Second dispatch attempt should still fail.");
    assert.equal(secondDispatch.retried, undefined, "Final dispatch failure should not retry again.");

    const jobsAfterDispatch = await publishJobStore.listPublishJobs();
    const failedDispatch = jobsAfterDispatch.find((job) => job.id === dispatchJob.id);
    assert.equal(failedDispatch?.status, "error", "Dispatch job should end in error after max attempts.");
    assert.equal(failedDispatch?.attempts, 2, "Dispatch job should record both attempts.");

    const lockFile = path.join(tempRoot, ".openclaw-data", "publish-queue.lock");
    assert(!fs.existsSync(lockFile), "Publish queue lock should be released after processing.");

    console.log("publish queue regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function main() {
  const localStorage = installBrowserStub();
  await runSalesAndKnowledgeRegression(localStorage);
  await runSupportAndKnowledgeRegression(localStorage);
  await runKnowledgeReuseSourceGuard();
  await runPublishQueueRegression();
  console.log("\n[workflow-regression] all core workflow regressions passed");
}

main().catch((error) => {
  console.error("\n[workflow-regression] failed");
  console.error(error);
  process.exitCode = 1;
});

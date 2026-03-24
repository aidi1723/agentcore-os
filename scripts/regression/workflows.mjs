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

class ThrowingStorage {
  getItem() {
    throw new Error("Storage read failed");
  }

  setItem() {
    throw new Error("Storage write failed");
  }

  removeItem() {
    throw new Error("Storage remove failed");
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

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compareWorkflowRunPriority(left, right) {
  if ((left?.createdAt ?? 0) !== (right?.createdAt ?? 0)) {
    return (left?.createdAt ?? 0) - (right?.createdAt ?? 0);
  }
  if ((left?.updatedAt ?? 0) !== (right?.updatedAt ?? 0)) {
    return (left?.updatedAt ?? 0) - (right?.updatedAt ?? 0);
  }
  return String(left?.id ?? "").localeCompare(String(right?.id ?? ""), "en");
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

async function runAppApiAndStorageRegression(localStorage) {
  logSection("app api + storage guard");
  resetBrowserState(localStorage);

  delete globalThis.window.__AGENTCORE_API_BASE_URL__;
  delete globalThis.window.__AGENTCORE_DESKTOP_SHELL__;

  const appApi = await import(moduleUrl("src/lib/app-api.ts"));
  const settings = await import(moduleUrl("src/lib/settings.ts"));
  const storage = await import(moduleUrl("src/lib/storage.ts"));

  const browserOnlyUrl = appApi.buildAgentCoreApiUrl("/api/runtime/doctor");
  assert.equal(
    browserOnlyUrl,
    "/api/runtime/doctor",
    "Browser-only mode should use same-origin APIs by default.",
  );

  globalThis.window.__AGENTCORE_DESKTOP_SHELL__ = true;
  globalThis.window.__AGENTCORE_API_BASE_URL__ = "http://127.0.0.1:8080/";
  const desktopUrl = appApi.buildAgentCoreApiUrl("/api/runtime/doctor");
  assert.equal(
    desktopUrl,
    "http://127.0.0.1:8080/api/runtime/doctor",
    "Desktop shell should honor the injected sidecar API base.",
  );

  delete globalThis.window.__AGENTCORE_API_BASE_URL__;
  delete globalThis.window.__AGENTCORE_DESKTOP_SHELL__;

  assert.doesNotThrow(() => {
    storage.setJsonToStorage("agentcore.test.storage", { ok: true }, new ThrowingStorage());
  }, "Storage writes should not crash the app when the browser blocks persistence.");

  const fallback = storage.getJsonFromStorage(
    "agentcore.test.storage",
    { ok: false },
    new ThrowingStorage(),
  );
  assert.deepEqual(
    fallback,
    { ok: false },
    "Storage reads should fall back cleanly when persistence is unavailable.",
  );

  settings.saveSettings(settings.defaultSettings);
  console.log("app api and storage guard passed");
}

async function runRequestBodyGuardRegression() {
  logSection("request body guard");

  const requestBody = await import(moduleUrl("src/lib/server/request-body.ts"));

  const valid = await requestBody.readJsonBodyWithLimit(
    new Request("http://localhost/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: true }),
    }),
    1024,
  );
  assert.equal(valid?.ok, true, "Valid JSON body should parse successfully.");

  await assert.rejects(
    () =>
      requestBody.readJsonBodyWithLimit(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ bad: true }),
        }),
        1024,
      ),
    (error) =>
      error instanceof Error &&
      requestBody.getRequestBodyErrorStatus(error) === 415,
    "Non-JSON requests should be rejected with 415.",
  );

  await assert.rejects(
    () =>
      requestBody.readJsonBodyWithLimit(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{not-json",
        }),
        1024,
      ),
    (error) =>
      error instanceof Error &&
      requestBody.getRequestBodyErrorStatus(error) === 400,
    "Invalid JSON should be rejected with 400.",
  );

  await assert.rejects(
    () =>
      requestBody.readJsonBodyWithLimit(
        new Request("http://localhost/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ huge: "x".repeat(2048) }),
        }),
        64,
      ),
    (error) =>
      error instanceof Error &&
      requestBody.getRequestBodyErrorStatus(error) === 413,
    "Oversized JSON should be rejected with 413.",
  );

  console.log("request body guard regression passed");
}

async function runServerBackedRetryRegression(localStorage) {
  logSection("server backed retry");
  resetBrowserState(localStorage);

  const listState = await import(moduleUrl("src/lib/server-backed-list-state.ts"));
  const originalFetch = globalThis.fetch;
  let attempts = 0;

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url ?? "");
    const method = init?.method ?? "GET";

    if (url.endsWith("/api/runtime/test-sync") && method === "POST") {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("temporary network failure");
      }
      const payload = init?.body ? JSON.parse(String(init.body)) : {};
      return new Response(
        JSON.stringify({
          ok: true,
          data: { item: payload.item, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url.endsWith("/api/runtime/test-sync") && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { items: [], tombstones: [] },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    const state = listState.createServerBackedListState({
      statusId: "agentcore.retry.test",
      statusLabel: "Retry Test",
      storageKey: "agentcore.retry.test",
      eventName: "agentcore:retry-test",
      maxItems: 10,
      listPath: "/api/runtime/test-sync",
      itemBodyKey: "item",
      retryBaseMs: 10,
      retryMaxMs: 20,
      sortItems: (items) => items.slice().sort((a, b) => b.updatedAt - a.updatedAt),
      parseHydrateData: (data) => ({
        items: Array.isArray(data?.data?.items) ? data.data.items : null,
        tombstones: Array.isArray(data?.data?.tombstones) ? data.data.tombstones : [],
      }),
      parseUpsertData: (data) => ({
        item: data?.data?.item ?? null,
        tombstone: data?.data?.tombstone ?? null,
      }),
    });

    state.saveLocal([{ id: "retry-item-1", updatedAt: 100, value: "local" }]);
    await state.syncItemToServer({ id: "retry-item-1", updatedAt: 100, value: "local" });
    await waitMs(160);

    assert.equal(attempts >= 2, true, "Failed syncs should retry automatically.");
    assert.equal(
      state.getPendingSyncCount(),
      0,
      "Retry queue should drain after a successful retry.",
    );
    assert.equal(
      listState.getServerBackedSyncStatus("agentcore.retry.test")?.pendingCount,
      0,
      "Sync status snapshot should reflect the drained retry queue.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("server backed retry regression passed");
}

async function runAgentExecutorRegression(localStorage) {
  logSection("agent executor core");
  resetBrowserState(localStorage);

  const executor = await import(moduleUrl("src/lib/executor/core.ts"));
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedPayload = null;

  globalThis.fetch = async (input, init) => {
    capturedUrl = typeof input === "string" ? input : String(input?.url ?? "");
    capturedPayload = init?.body ? JSON.parse(String(init.body)) : null;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "executor-ok" } }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  try {
    const payload = await executor.runAgentCoreTask({
      message: "请输出一段销售跟进建议",
      sessionId: "regression-agent-route",
      timeoutSeconds: 30,
      systemPrompt: "You are a specialist sales copilot.",
      useSkills: true,
      workspaceContext: {
        activeIndustry: "doors_windows",
        activeScenarioId: "sales-followup",
        runtimeProfile: "desktop_light",
      },
      llm: {
        provider: "openai",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    });

    assert.equal(payload.ok, true, "Executor should succeed with direct model config.");
    assert.equal(payload.text, "executor-ok", "Executor should surface model output.");
    assert.equal(payload.engine, "agentcore_executor", "Executor should use the internal model adapter when llm config is present.");
    assert.equal(
      capturedUrl,
      "https://api.openai.com/v1/chat/completions",
      "Internal executor should call the configured model endpoint directly.",
    );
    assert.equal(capturedPayload?.model, "gpt-4o-mini", "Executor should forward the configured model.");
    assert.match(
      capturedPayload?.messages?.[0]?.content ?? "",
      /specialist sales copilot/i,
      "Executor should keep the explicit system prompt.",
    );
    assert.match(
      capturedPayload?.messages?.[0]?.content ?? "",
      /activeIndustry=doors_windows/,
      "Executor should include workspace context in the system prompt.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("agent executor regression passed");
}

async function runExecutorSessionStoreRegression() {
  logSection("executor session store");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-executor-session-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "session-store-ok" } }],
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );

  try {
    const runner = await import(moduleUrl("src/lib/server/executor-runner.ts"));
    const sessionStore = await import(moduleUrl("src/lib/server/executor-session-store.ts"));

    const result = await runner.executeAgentCoreTask({
      source: "regression/executor-session",
      message: "请总结这个客户的下一步动作",
      sessionId: "regression-session-store",
      timeoutSeconds: 20,
      systemPrompt: "You are a disciplined sales reviewer.",
      useSkills: true,
      workspaceContext: {
        activeIndustry: "doors_windows",
        activeScenarioId: "sales-followup",
      },
      llm: {
        provider: "openai",
        apiKey: "super-secret-key",
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      },
    });

    assert.equal(result.ok, true, "Executor runner should succeed before session persistence checks.");

    const session = await sessionStore.getExecutorSession("regression-session-store");
    assert(session, "Executor session should be persisted.");
    assert.equal(session.id, "regression-session-store", "Persisted session id should match.");
    assert.equal(session.turns.length, 1, "One executor turn should be recorded.");
    assert.equal(
      session.turns[0]?.llmProvider,
      "openai",
      "Persisted turn should include the model provider.",
    );
    assert.equal(
      session.turns[0]?.llmModel,
      "gpt-4o-mini",
      "Persisted turn should include the model name.",
    );
    assert.match(
      session.turns[0]?.outputText ?? "",
      /session-store-ok/,
      "Persisted turn should include the model output.",
    );
    assert.equal(
      "apiKey" in (session.turns[0] ?? {}),
      false,
      "Executor session persistence must not store API keys.",
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }

  console.log("executor session store regression passed");
}

async function runCoreStateServerSyncRegression(localStorage) {
  logSection("core state server sync");
  resetBrowserState(localStorage);

  const deals = await import(moduleUrl("src/lib/deals.ts"));
  const support = await import(moduleUrl("src/lib/support.ts"));
  const workflowRuns = await import(moduleUrl("src/lib/workflow-runs.ts"));
  const salesWorkflow = await import(moduleUrl("src/lib/sales-workflow.ts"));

  const originalFetch = globalThis.fetch;
  const requests = [];
  const salesScenario = salesWorkflow.getSalesWorkflowScenario();
  let serverDeals = [
    {
      id: "server-deal-1",
      company: "Server Deal",
      contact: "Lia",
      inquiryChannel: "Email",
      preferredLanguage: "English",
      productLine: "Window",
      need: "Server-side sync",
      budget: "",
      timing: "",
      stage: "qualified",
      notes: "",
      brief: "Loaded from server",
      reviewNotes: "",
      createdAt: 100,
      updatedAt: 200,
    },
  ];
  let serverDealTombstones = [];
  let serverTickets = [
    {
      id: "server-ticket-1",
      customer: "Server Nora",
      channel: "whatsapp",
      subject: "Loaded from server",
      message: "Support sync",
      status: "waiting",
      replyDraft: "Reply from server",
      reviewNotes: "",
      createdAt: 100,
      updatedAt: 200,
    },
  ];
  let serverSupportTombstones = [];
  let serverWorkflowRuns = [
    {
      id: "server-run-1",
      scenarioId: salesScenario.id,
      scenarioTitle: salesScenario.title,
      triggerType: "manual",
      state: "running",
      currentStageId: salesScenario.workflowStages[0].id,
      stageRuns: salesScenario.workflowStages.map((stage, index) => ({
        id: stage.id,
        title: stage.title,
        mode: stage.mode,
        state: index === 0 ? "running" : "pending",
      })),
      createdAt: 100,
      updatedAt: 200,
    },
  ];
  let serverWorkflowTombstones = [];

  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : String(input?.url ?? "");
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    requests.push({ url, method, body });

    if (url === "/api/runtime/state/deals" && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            deals: serverDeals,
            tombstones: serverDealTombstones,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/deals" && method === "POST") {
      const candidate = body?.deal;
      const existingTombstone = serverDealTombstones.find(
        (tombstone) => tombstone.id === candidate?.id,
      );
      if (existingTombstone && existingTombstone.deletedAt >= candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { deal: null, tombstone: existingTombstone, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const existing = serverDeals.find((deal) => deal.id === candidate?.id);
      if (existing && existing.updatedAt > candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { deal: existing, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      serverDealTombstones = serverDealTombstones.filter(
        (tombstone) => tombstone.id !== candidate.id,
      );
      serverDeals = [candidate, ...serverDeals.filter((deal) => deal.id !== candidate.id)];
      return new Response(
        JSON.stringify({
          ok: true,
          data: { deal: candidate, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/deals/server-deal-1" && method === "DELETE") {
      const existing = serverDeals.find((deal) => deal.id === "server-deal-1") ?? null;
      if (existing && existing.updatedAt > (body?.updatedAt ?? 0)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "conflict",
            data: { removed: false, conflict: true, deal: existing, tombstone: null },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const tombstone = {
        id: "server-deal-1",
        updatedAt: 500,
        deletedAt: 500,
      };
      serverDealTombstones = [
        tombstone,
        ...serverDealTombstones.filter((entry) => entry.id !== "server-deal-1"),
      ];
      serverDeals = serverDeals.filter((deal) => deal.id !== "server-deal-1");
      return new Response(
        JSON.stringify({
          ok: true,
          data: { removed: true, conflict: false, deal: existing, tombstone },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/support" && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            tickets: serverTickets,
            tombstones: serverSupportTombstones,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/support" && method === "POST") {
      const candidate = body?.ticket;
      const existingTombstone = serverSupportTombstones.find(
        (tombstone) => tombstone.id === candidate?.id,
      );
      if (existingTombstone && existingTombstone.deletedAt >= candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { ticket: null, tombstone: existingTombstone, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const existing = serverTickets.find((ticket) => ticket.id === candidate?.id);
      if (existing && existing.updatedAt > candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { ticket: existing, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      serverSupportTombstones = serverSupportTombstones.filter(
        (tombstone) => tombstone.id !== candidate.id,
      );
      serverTickets = [
        candidate,
        ...serverTickets.filter((ticket) => ticket.id !== candidate.id),
      ];
      return new Response(
        JSON.stringify({
          ok: true,
          data: { ticket: candidate, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/workflow-runs" && method === "GET") {
      return new Response(
        JSON.stringify({
          ok: true,
          data: {
            workflowRuns: serverWorkflowRuns,
            tombstones: serverWorkflowTombstones,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    if (url === "/api/runtime/state/workflow-runs" && method === "POST") {
      const candidate = body?.workflowRun;
      const existingTombstone = serverWorkflowTombstones.find(
        (tombstone) => tombstone.id === candidate?.id,
      );
      if (existingTombstone) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { workflowRun: null, tombstone: existingTombstone, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const existing = serverWorkflowRuns.find((workflowRun) => workflowRun.id === candidate?.id);
      if (existing && existing.updatedAt > candidate?.updatedAt) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { workflowRun: existing, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const activeScenarioRun =
        serverWorkflowRuns.find(
          (workflowRun) =>
            workflowRun.scenarioId === candidate?.scenarioId &&
            workflowRun.id !== candidate?.id,
        ) ?? null;
      if (activeScenarioRun && compareWorkflowRunPriority(activeScenarioRun, candidate) >= 0) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { workflowRun: activeScenarioRun, tombstone: null, accepted: false },
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      const supersededRuns = serverWorkflowRuns.filter(
        (workflowRun) =>
          workflowRun.scenarioId === candidate.scenarioId && workflowRun.id !== candidate.id,
      );
      serverWorkflowTombstones = [
        ...supersededRuns.map((workflowRun) => ({
          id: workflowRun.id,
          scenarioId: workflowRun.scenarioId,
          updatedAt: candidate.createdAt,
          deletedAt: candidate.createdAt,
        })),
        ...serverWorkflowTombstones.filter(
          (tombstone) =>
            !supersededRuns.some((workflowRun) => workflowRun.id === tombstone.id) &&
            tombstone.id !== candidate.id,
        ),
      ];
      serverWorkflowRuns = [
        candidate,
        ...serverWorkflowRuns.filter(
          (workflowRun) =>
            workflowRun.id !== candidate.id &&
            workflowRun.scenarioId !== candidate.scenarioId,
        ),
      ];
      return new Response(
        JSON.stringify({
          ok: true,
          data: { workflowRun: candidate, tombstone: null, accepted: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  try {
    deals.createDeal({ company: "Sync Deal" });
    support.createSupportTicket({ customer: "Sync Customer", subject: "Sync Subject" });
    workflowRuns.startWorkflowRun(salesScenario, "manual");

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert(
      requests.some((entry) => entry.url === "/api/runtime/state/deals" && entry.method === "POST"),
      "Deals should upsert to the server after local changes.",
    );
    assert(
      requests.some(
        (entry) => entry.url === "/api/runtime/state/support" && entry.method === "POST",
      ),
      "Support tickets should upsert to the server after local changes.",
    );
    assert(
      requests.some(
        (entry) =>
          entry.url === "/api/runtime/state/workflow-runs" && entry.method === "POST",
      ),
      "Workflow runs should upsert to the server after local changes.",
    );

    serverDeals = [
      {
        id: "server-deal-1",
        company: "Server Deal",
        contact: "Lia",
        inquiryChannel: "Email",
        preferredLanguage: "English",
        productLine: "Window",
        need: "Server-side sync",
        budget: "",
        timing: "",
        stage: "qualified",
        notes: "",
        brief: "Loaded from server",
        reviewNotes: "",
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverDealTombstones = [];
    serverTickets = [
      {
        id: "server-ticket-1",
        customer: "Server Nora",
        channel: "whatsapp",
        subject: "Loaded from server",
        message: "Support sync",
        status: "waiting",
        replyDraft: "Reply from server",
        reviewNotes: "",
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverSupportTombstones = [];
    serverWorkflowRuns = [
      {
        id: "server-run-1",
        scenarioId: salesScenario.id,
        scenarioTitle: salesScenario.title,
        triggerType: "manual",
        state: "running",
        currentStageId: salesScenario.workflowStages[0].id,
        stageRuns: salesScenario.workflowStages.map((stage, index) => ({
          id: stage.id,
          title: stage.title,
          mode: stage.mode,
          state: index === 0 ? "running" : "pending",
        })),
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverWorkflowTombstones = [];

    localStorage.clear();
    await deals.hydrateDealsFromServer(true);
    await support.hydrateSupportTicketsFromServer(true);
    await workflowRuns.hydrateWorkflowRunsFromServer(true);

    assert.equal(
      deals.getDeals()[0]?.id,
      "server-deal-1",
      "Deals should hydrate from the server store.",
    );
    assert.equal(
      support.getSupportTickets()[0]?.id,
      "server-ticket-1",
      "Support tickets should hydrate from the server store.",
    );
    assert.equal(
      workflowRuns.getWorkflowRuns()[0]?.id,
      "server-run-1",
      "Workflow runs should hydrate from the server store.",
    );

    serverDeals = [
      {
        ...serverDeals[0],
        company: "Server Deal Newer",
        updatedAt: 999,
      },
    ];
    serverDealTombstones = [];

    deals.removeDeal("server-deal-1");
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      deals.getDeals()[0]?.company,
      "Server Deal Newer",
      "Delete conflicts should restore the newer server deal locally.",
    );
    assert.equal(
      deals.getDeals()[0]?.updatedAt,
      999,
      "Delete conflicts should preserve the newer server timestamp.",
    );

    requests.length = 0;
    localStorage.setItem(
      "openclaw.deals.v1",
      JSON.stringify([
        {
          id: "local-newer-deal",
          company: "Local Newer Deal",
          contact: "Ava",
          inquiryChannel: "WhatsApp",
          preferredLanguage: "English",
          productLine: "Door",
          need: "Keep local newer state",
          budget: "",
          timing: "",
          stage: "proposal",
          notes: "",
          brief: "Pending local sync",
          reviewNotes: "",
          createdAt: 300,
          updatedAt: 600,
        },
      ]),
    );
    serverDeals = [
      {
        id: "server-only-deal",
        company: "Server Only Deal",
        contact: "Mia",
        inquiryChannel: "Email",
        preferredLanguage: "English",
        productLine: "Window",
        need: "Server snapshot",
        budget: "",
        timing: "",
        stage: "new",
        notes: "",
        brief: "",
        reviewNotes: "",
        createdAt: 100,
        updatedAt: 200,
      },
    ];
    serverDealTombstones = [];

    await deals.hydrateDealsFromServer(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert(
      deals.getDeals().some((deal) => deal.id === "local-newer-deal"),
      "Hydration should preserve newer local deals instead of overwriting them.",
    );
    assert(
      requests.some(
        (entry) =>
          entry.url === "/api/runtime/state/deals" &&
          entry.method === "POST" &&
          entry.body?.deal?.id === "local-newer-deal",
      ),
      "Hydration should resync newer local deals back to the server.",
    );

    requests.length = 0;
    localStorage.setItem(
      "openclaw.deals.v1",
      JSON.stringify([
        {
          id: "deleted-deal-1",
          company: "Deleted Deal",
          contact: "Theo",
          inquiryChannel: "Email",
          preferredLanguage: "English",
          productLine: "Window",
          need: "Should stay deleted",
          budget: "",
          timing: "",
          stage: "qualified",
          notes: "",
          brief: "",
          reviewNotes: "",
          createdAt: 100,
          updatedAt: 150,
        },
      ]),
    );
    serverDeals = [];
    serverDealTombstones = [
      {
        id: "deleted-deal-1",
        updatedAt: 400,
        deletedAt: 400,
      },
    ];

    await deals.hydrateDealsFromServer(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(
      deals.getDeals().some((deal) => deal.id === "deleted-deal-1"),
      false,
      "Hydration should drop local deals that are already deleted on the server.",
    );
    assert.equal(
      requests.some(
        (entry) =>
          entry.url === "/api/runtime/state/deals" &&
          entry.method === "POST" &&
          entry.body?.deal?.id === "deleted-deal-1",
      ),
      false,
      "Hydration should not resurrect a server-deleted deal from stale local cache.",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log("core state server sync regression passed");
}

async function runWorkflowRunStoreRegression() {
  logSection("workflow run tombstone boundary");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-workflow-run-store-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const store = await import(moduleUrl("src/lib/server/workflow-run-store.ts"));

    const olderRun = {
      id: "run-old",
      scenarioId: "sales-followup",
      scenarioTitle: "Sales Follow-up",
      triggerType: "manual",
      state: "running",
      currentStageId: "qualify",
      stageRuns: [{ id: "qualify", title: "Qualify", mode: "auto", state: "running" }],
      createdAt: 100,
      updatedAt: 120,
    };
    const newerRun = {
      ...olderRun,
      id: "run-new",
      currentStageId: "draft",
      stageRuns: [{ id: "draft", title: "Draft", mode: "auto", state: "running" }],
      createdAt: 200,
      updatedAt: 210,
    };

    const firstInsert = await store.upsertWorkflowRunInStore(olderRun);
    assert.equal(firstInsert.accepted, true, "Initial workflow run should store successfully.");

    const secondInsert = await store.upsertWorkflowRunInStore(newerRun);
    assert.equal(secondInsert.accepted, true, "Newer workflow run should supersede the old run.");

    const snapshot = await store.listWorkflowRunStoreSnapshot();
    assert.deepEqual(
      snapshot.workflowRuns.map((run) => run.id),
      ["run-new"],
      "Only the latest started run should remain active for a scenario.",
    );
    assert.equal(
      snapshot.tombstones.some((tombstone) => tombstone.id === "run-old"),
      true,
      "Superseded workflow runs should leave a tombstone boundary.",
    );

    const resurrect = await store.upsertWorkflowRunInStore({
      ...olderRun,
      updatedAt: 999,
    });
    assert.equal(resurrect.accepted, false, "Superseded workflow run ids should not resurrect.");
    assert.equal(
      resurrect.tombstone?.id,
      "run-old",
      "Superseded workflow runs should reject with their tombstone.",
    );

    const removed = await store.removeWorkflowRunFromStore("run-new", newerRun.updatedAt);
    assert.equal(removed.removed, true, "Workflow runs should support tombstone-backed delete.");

    const afterDelete = await store.listWorkflowRunStoreSnapshot();
    assert.equal(
      afterDelete.workflowRuns.length,
      0,
      "Deleting the active workflow run should clear it from the live snapshot.",
    );
    assert.equal(
      afterDelete.tombstones.some((tombstone) => tombstone.id === "run-new"),
      true,
      "Deleting a workflow run should persist a tombstone.",
    );

    console.log("workflow run tombstone boundary regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function runLegacyPutGuardRegression() {
  logSection("legacy put guard");
  const routeFiles = [
    path.join(PROJECT_ROOT, "src", "app", "api", "runtime", "state", "deals", "route.ts"),
    path.join(PROJECT_ROOT, "src", "app", "api", "runtime", "state", "support", "route.ts"),
    path.join(
      PROJECT_ROOT,
      "src",
      "app",
      "api",
      "runtime",
      "state",
      "workflow-runs",
      "route.ts",
    ),
  ];

  for (const file of routeFiles) {
    const source = await readFile(file, "utf8");
    assert.match(
      source,
      /x-agentcore-allow-full-replace/,
      "Legacy full-replace routes should require an explicit override header.",
    );
    assert.match(
      source,
      /status:\s*409/,
      "Legacy full-replace routes should reject snapshot overwrite by default.",
    );
  }

  console.log("legacy put guard regression passed");
}

async function runJsonStoreRegression() {
  logSection("json store hardening");
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "agentcore-json-store-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    const jsonStore = await import(moduleUrl("src/lib/server/json-store.ts"));

    await jsonStore.writeJsonFile("atomic.json", { version: 1 });
    await jsonStore.writeJsonFile("atomic.json", { version: 2 });

    const dataDir = path.join(tempRoot, ".openclaw-data");
    const mainFile = path.join(dataDir, "atomic.json");
    const backupFile = path.join(dataDir, "atomic.json.bak");

    assert.equal(
      fs.existsSync(backupFile),
      true,
      "Successful writes should maintain a backup file.",
    );

    fs.writeFileSync(mainFile, "{broken-json", "utf8");
    const recovered = await jsonStore.readJsonFile("atomic.json", { version: 0 });
    assert.equal(recovered.version, 2, "Corrupted primary JSON should recover from backup.");

    await Promise.all(
      Array.from({ length: 12 }, () =>
        jsonStore.readModifyWrite("counter.json", { value: 0 }, (current) => ({
          value: current.value + 1,
        })),
      ),
    );

    const counter = await jsonStore.readJsonFile("counter.json", { value: 0 });
    assert.equal(counter.value, 12, "Store locking should serialize read-modify-write updates.");

    console.log("json store hardening regression passed");
  } finally {
    process.chdir(previousCwd);
    await rm(tempRoot, { recursive: true, force: true });
  }
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
  await runAppApiAndStorageRegression(localStorage);
  await runRequestBodyGuardRegression();
  await runServerBackedRetryRegression(localStorage);
  await runAgentExecutorRegression(localStorage);
  await runExecutorSessionStoreRegression();
  await runCoreStateServerSyncRegression(localStorage);
  await runWorkflowRunStoreRegression();
  await runLegacyPutGuardRegression();
  await runJsonStoreRegression();
  await runPublishQueueRegression();
  console.log("\n[workflow-regression] all core workflow regressions passed");
}

main().catch((error) => {
  console.error("\n[workflow-regression] failed");
  console.error(error);
  process.exitCode = 1;
});

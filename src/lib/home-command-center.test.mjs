import assert from "node:assert/strict";

const mod = await import("./home-command-center.ts");

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

test("buildCommandCenterShortcuts returns the four stable command areas", () => {
  const shortcuts = mod.buildCommandCenterShortcuts({
    runtimeReady: true,
    runtimeLabel: "Desktop Runtime",
    scenarioTitle: "销售获客",
    workflowAppId: "deal_desk",
    assetAppId: "knowledge_vault",
    language: "zh-CN",
  });

  assert.deepEqual(
    shortcuts.map((item) => [item.id, item.appId, item.label]),
    [
      ["workflows", "deal_desk", "工作流"],
      ["approvals", "task_manager", "审批"],
      ["assets", "knowledge_vault", "资产"],
      ["runtime", "runtime_console", "运行时"],
    ],
  );
  assert.equal(shortcuts[0].detail, "销售获客");
  assert.equal(shortcuts[3].tone, "success");
});

test("buildCommandCenterShortcuts marks runtime warning when not ready", () => {
  const shortcuts = mod.buildCommandCenterShortcuts({
    runtimeReady: false,
    runtimeLabel: "AgentCoreOS Runtime",
    scenarioTitle: "",
    workflowAppId: null,
    assetAppId: null,
    language: "en-US",
  });

  const runtime = shortcuts.find((item) => item.id === "runtime");
  assert.equal(runtime.tone, "warning");
  assert.equal(runtime.detail, "Runtime needs attention");
});

test("buildCommandCenterAssets prefers scenario assets then starter assets", () => {
  assert.deepEqual(
    mod.buildCommandCenterAssets({
      scenarioAssets: ["报价草案", "客户分级"],
      starterAssets: ["客户偏好"],
      limit: 3,
    }),
    ["报价草案", "客户分级"],
  );

  assert.deepEqual(
    mod.buildCommandCenterAssets({
      scenarioAssets: [],
      starterAssets: ["客户偏好", "报价状态", "跟进节奏", "复盘记录"],
      limit: 3,
    }),
    ["客户偏好", "报价状态", "跟进节奏"],
  );
});

test("buildCommandCenterAttentionCards exposes approvals tasks failures and runtime", () => {
  const cards = mod.buildCommandCenterAttentionCards({
    pendingApprovalCount: 2,
    runningCount: 1,
    failedCount: 1,
    runtimeReady: false,
    language: "zh-CN",
  });

  assert.deepEqual(
    cards.map((item) => [item.id, item.value, item.tone]),
    [
      ["approvals", "2", "warning"],
      ["running", "1", "neutral"],
      ["failures", "1", "danger"],
      ["runtime", "需检查", "warning"],
    ],
  );
});

if (process.exitCode) {
  process.exit(process.exitCode);
}

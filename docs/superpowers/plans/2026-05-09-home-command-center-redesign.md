# Home Command Center Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current glassy desktop-first home screen with a clean single-page command center that exposes business scenarios, execution controls, approvals, assets, and runtime status in one view.

**Architecture:** Keep the existing Next.js home page, app registry, window state, and runtime event behavior. Extract command-center view-model helpers into `src/lib/home-command-center.ts` so shortcuts, status panels, and assets have testable rules, then restyle `src/app/page.tsx` around a three-column A1 layout.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Node assert-based tests run through `scripts/register-ts-alias-loader.mjs`.

---

### Task 1: Add Command Center View-Model Helpers

**Files:**
- Create: `src/lib/home-command-center.ts`
- Create: `src/lib/home-command-center.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `src/lib/home-command-center.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import ./scripts/register-ts-alias-loader.mjs src/lib/home-command-center.test.mjs`

Expected: fail with module-not-found for `home-command-center.ts`.

- [ ] **Step 3: Implement helper module**

Create `src/lib/home-command-center.ts`:

```ts
import type { AppId } from "@/apps/types";
import type { InterfaceLanguage } from "@/lib/settings";

export type CommandCenterShortcutId = "workflows" | "approvals" | "assets" | "runtime";
export type CommandCenterTone = "neutral" | "success" | "warning" | "danger";

export type CommandCenterShortcut = {
  id: CommandCenterShortcutId;
  appId: AppId;
  label: string;
  detail: string;
  tone: CommandCenterTone;
};

export type CommandCenterAttentionCard = {
  id: "approvals" | "running" | "failures" | "runtime";
  label: string;
  value: string;
  detail: string;
  tone: CommandCenterTone;
};

function displayLanguage(language: InterfaceLanguage) {
  if (language === "en-US") return "en";
  if (language === "ja-JP") return "ja";
  return "zh";
}

export function buildCommandCenterShortcuts({
  runtimeReady,
  runtimeLabel,
  scenarioTitle,
  workflowAppId,
  assetAppId,
  language,
}: {
  runtimeReady: boolean;
  runtimeLabel: string;
  scenarioTitle?: string | null;
  workflowAppId?: AppId | null;
  assetAppId?: AppId | null;
  language: InterfaceLanguage;
}): CommandCenterShortcut[] {
  const lang = displayLanguage(language);
  const text = {
    zh: {
      workflows: "工作流",
      approvals: "审批",
      assets: "资产",
      runtime: "运行时",
      workflowFallback: "选择角色桌面后继续执行",
      approvalsDetail: "人工确认、阻塞项和任务状态",
      assetsDetail: "沉淀可复用结果与知识",
      runtimeWarning: "Runtime 需要检查",
    },
    en: {
      workflows: "Workflows",
      approvals: "Approvals",
      assets: "Assets",
      runtime: "Runtime",
      workflowFallback: "Choose a role desk to continue",
      approvalsDetail: "Human checks, blockers, and task state",
      assetsDetail: "Reusable results and knowledge",
      runtimeWarning: "Runtime needs attention",
    },
    ja: {
      workflows: "Workflows",
      approvals: "Approvals",
      assets: "Assets",
      runtime: "Runtime",
      workflowFallback: "ロールデスクを選んで続行",
      approvalsDetail: "確認、ブロック、タスク状態",
      assetsDetail: "再利用できる成果と知識",
      runtimeWarning: "Runtime needs attention",
    },
  }[lang];

  return [
    {
      id: "workflows",
      appId: workflowAppId ?? "task_manager",
      label: text.workflows,
      detail: scenarioTitle?.trim() || text.workflowFallback,
      tone: "neutral",
    },
    {
      id: "approvals",
      appId: "task_manager",
      label: text.approvals,
      detail: text.approvalsDetail,
      tone: "warning",
    },
    {
      id: "assets",
      appId: assetAppId ?? "knowledge_vault",
      label: text.assets,
      detail: text.assetsDetail,
      tone: "success",
    },
    {
      id: "runtime",
      appId: "runtime_console",
      label: text.runtime,
      detail: runtimeReady ? runtimeLabel : text.runtimeWarning,
      tone: runtimeReady ? "success" : "warning",
    },
  ];
}

export function buildCommandCenterAssets({
  scenarioAssets,
  starterAssets,
  limit,
}: {
  scenarioAssets: string[];
  starterAssets: string[];
  limit: number;
}) {
  const source = scenarioAssets.length ? scenarioAssets : starterAssets;
  return source.map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

export function buildCommandCenterAttentionCards({
  pendingApprovalCount,
  runningCount,
  failedCount,
  runtimeReady,
  language,
}: {
  pendingApprovalCount: number;
  runningCount: number;
  failedCount: number;
  runtimeReady: boolean;
  language: InterfaceLanguage;
}): CommandCenterAttentionCard[] {
  const lang = displayLanguage(language);
  const text = {
    zh: {
      approvals: "待人工确认",
      approvalsDetail: "需要判断、授权或复核",
      running: "运行中任务",
      runningDetail: "正在执行或窗口已打开",
      failures: "失败/重试",
      failuresDetail: "需要检查异常链路",
      runtime: "运行时",
      runtimeReady: "正常",
      runtimeWarning: "需检查",
      runtimeDetail: "AgentCoreOS Runtime 状态",
    },
    en: {
      approvals: "Approvals",
      approvalsDetail: "Needs review or authorization",
      running: "Running",
      runningDetail: "Executing or already opened",
      failures: "Failures",
      failuresDetail: "Needs recovery",
      runtime: "Runtime",
      runtimeReady: "Ready",
      runtimeWarning: "Check",
      runtimeDetail: "AgentCoreOS Runtime state",
    },
    ja: {
      approvals: "Approvals",
      approvalsDetail: "確認または承認が必要",
      running: "Running",
      runningDetail: "実行中または開いています",
      failures: "Failures",
      failuresDetail: "復旧が必要",
      runtime: "Runtime",
      runtimeReady: "Ready",
      runtimeWarning: "Check",
      runtimeDetail: "AgentCoreOS Runtime state",
    },
  }[lang];

  return [
    {
      id: "approvals",
      label: text.approvals,
      value: String(Math.max(0, pendingApprovalCount)),
      detail: text.approvalsDetail,
      tone: pendingApprovalCount > 0 ? "warning" : "neutral",
    },
    {
      id: "running",
      label: text.running,
      value: String(Math.max(0, runningCount)),
      detail: text.runningDetail,
      tone: "neutral",
    },
    {
      id: "failures",
      label: text.failures,
      value: String(Math.max(0, failedCount)),
      detail: text.failuresDetail,
      tone: failedCount > 0 ? "danger" : "neutral",
    },
    {
      id: "runtime",
      label: text.runtime,
      value: runtimeReady ? text.runtimeReady : text.runtimeWarning,
      detail: text.runtimeDetail,
      tone: runtimeReady ? "success" : "warning",
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --import ./scripts/register-ts-alias-loader.mjs src/lib/home-command-center.test.mjs`

Expected: all tests print `ok - ...`.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/lib/home-command-center.ts src/lib/home-command-center.test.mjs
git commit -m "test: cover home command center model"
```

### Task 2: Wire Helpers Into Home Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Import helper functions and types**

Add imports near the existing lib imports:

```ts
import {
  buildCommandCenterAssets,
  buildCommandCenterAttentionCards,
  buildCommandCenterShortcuts,
  type CommandCenterTone,
} from "@/lib/home-command-center";
```

- [ ] **Step 2: Derive command-center data in `SolutionCenterPanel`**

Inside `SolutionCenterPanel`, after `executionEvents` and `quickCommands`, derive:

```ts
  const runningWorkflowCount = workflowRuns.filter(
    (run) => run.state === "running" || run.state === "pending",
  ).length;
  const failedWorkflowCount = workflowRuns.filter((run) => run.state === "error").length;
  const pendingApprovalCount = selectedRun?.stageRuns.filter(
    (stage) => stage.mode === "approval" && stage.state !== "completed",
  ).length ?? 0;
  const commandCenterShortcuts = buildCommandCenterShortcuts({
    runtimeReady: true,
    runtimeLabel: providerLabel(activeProvider),
    scenarioTitle: roleDeskTitle,
    workflowAppId: selectedStarter.apps[0] ?? null,
    assetAppId: selectedStarter.apps.includes("knowledge_vault")
      ? "knowledge_vault"
      : (selectedStarter.apps.find((appId) => getAppCategory(appId) === "insight") ?? null),
    language,
  });
  const commandCenterAssets = buildCommandCenterAssets({
    scenarioAssets: selectedScenario?.resultAssets ?? [],
    starterAssets: selectedStarter.assets,
    limit: 4,
  });
  const attentionCards = buildCommandCenterAttentionCards({
    pendingApprovalCount,
    runningCount: runningWorkflowCount,
    failedCount: failedWorkflowCount,
    runtimeReady: true,
    language,
  });
```

- [ ] **Step 3: Run type check through build**

Run: `npm run build`

Expected: build reaches either success or an unrelated existing project error; no TypeScript errors from `home-command-center` imports or new derived values.

### Task 3: Replace `SolutionCenterPanel` Markup With A1 Layout

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add small style helper functions near `getWorkflowModeMeta` or before `SolutionCenterPanel`**

Add:

```ts
function commandCenterToneClass(tone: CommandCenterTone) {
  const map: Record<CommandCenterTone, string> = {
    neutral: "border-slate-200 bg-white text-slate-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950",
    warning: "border-amber-200 bg-amber-50 text-amber-950",
    danger: "border-rose-200 bg-rose-50 text-rose-950",
  };
  return map[tone];
}

function commandCenterToneDotClass(tone: CommandCenterTone) {
  const map: Record<CommandCenterTone, string> = {
    neutral: "bg-slate-400",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500",
  };
  return map[tone];
}
```

- [ ] **Step 2: Replace the outer `return` JSX for `SolutionCenterPanel`**

Replace the existing dark glass `<section className="rounded-[34px] ...">...</section>` return with a light three-column command center:

```tsx
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-slate-950 shadow-[0_20px_70px_rgba(15,23,42,0.12)] sm:p-4">
      <div className="grid gap-3 xl:grid-cols-[240px_minmax(0,1fr)_300px] 2xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="min-w-0 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <AgentCoreLogoMark size={22} roundedClassName="rounded-md" />
            <div>
              <div className="text-xs font-semibold uppercase text-slate-500">
                Business scenarios
              </div>
              <div className="text-sm font-semibold text-slate-950">{copy.rail}</div>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {groupedIndustries.map((item) => {
              const active = item.industry.id === selectedWorkspaceIndustryId;
              const leadStarter = item.starters[0];
              const starterRun =
                workflowRuns.find((run) => run.scenarioId === leadStarter.scenarioId) ?? null;
              const leadRoleDesk = leadStarter.roleId
                ? workspaceRoleDesks.find((desk) => desk.id === leadStarter.roleId) ?? null
                : null;
              const runMeta = getRunStateMeta(starterRun);
              return (
                <button
                  key={item.industry.id}
                  type="button"
                  onClick={() => setSelectedStarterId(leadStarter.id)}
                  className={[
                    "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-5">{item.industry.title}</div>
                      <div
                        className={[
                          "mt-1 text-xs leading-5",
                          active ? "text-white/68" : "text-slate-500",
                        ].join(" ")}
                      >
                        {leadRoleDesk?.title || leadStarter.triggerLabel}
                      </div>
                    </div>
                    <span
                      className={[
                        "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold",
                        active ? "bg-white/12 text-white/78" : "bg-slate-100 text-slate-500",
                      ].join(" ")}
                    >
                      {runMeta.label}
                    </span>
                  </div>
                  <div
                    className={[
                      "mt-2 line-clamp-2 text-xs leading-5",
                      active ? "text-white/58" : "text-slate-500",
                    ].join(" ")}
                  >
                    {leadRoleDesk?.desc || item.industry.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Command center
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-normal text-slate-950">
                  {roleDeskTitle}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                  {copy.commandHint}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {selectedIndustryGroup?.industry.title}
                </span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {providerLabel(activeProvider)}
                </span>
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {getCompactRunSummary(selectedRun, selectedScenario?.workflowStages.length ?? 0)}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
              <textarea
                value={commandDraft}
                onChange={(event) => setCommandDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendCommand();
                  }
                }}
                rows={3}
                placeholder={copy.commandPlaceholder}
                className="w-full resize-none bg-transparent px-4 py-4 text-[15px] leading-7 text-slate-950 outline-none placeholder:text-slate-400"
              />
              <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs leading-5 text-slate-500">{copy.enterHint}</div>
                <div className="flex flex-wrap gap-2">
                  {roleDesk ? (
                    <button
                      type="button"
                      onClick={() => onEnterRoleDesk(roleDesk, selectedStarter.industryId)}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {copy.role}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onLaunchStarter(selectedStarter)}
                    className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                  >
                    <PlayCircle className="h-3.5 w-3.5" />
                    {copy.launch}
                  </button>
                  <button
                    type="button"
                    disabled={commandLoading || !commandDraft.trim()}
                    onClick={() => void sendCommand()}
                    className="inline-flex items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    {copy.commandAction}
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-3 md:grid-cols-4">
            {commandCenterShortcuts.map((shortcut) => {
              const app = getApp(shortcut.appId);
              const Icon = app.icon;
              return (
                <button
                  key={shortcut.id}
                  type="button"
                  onClick={() => openApp(shortcut.appId)}
                  className={[
                    "rounded-lg border p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-white",
                    commandCenterToneClass(shortcut.tone),
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-white">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={[
                        "mt-1 h-2 w-2 rounded-full",
                        commandCenterToneDotClass(shortcut.tone),
                      ].join(" ")}
                    />
                  </div>
                  <div className="mt-3 text-sm font-semibold">{shortcut.label}</div>
                  <div className="mt-1 min-h-[40px] text-xs leading-5 opacity-70">
                    {shortcut.detail}
                  </div>
                </button>
              );
            })}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Active workflow
                </div>
                <div className="mt-1 text-base font-semibold text-slate-950">
                  {selectedScenario?.workflowTitle || selectedBundle.summary}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onOpenIndustryHub}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <BriefcaseBusiness className="h-3.5 w-3.5" />
                  {copy.industryHub}
                </button>
                <button
                  type="button"
                  onClick={onOpenSolutionsHub}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Bot className="h-3.5 w-3.5" />
                  {copy.library}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 md:grid-cols-4">
              {(selectedScenario?.workflowStages ?? []).slice(0, 4).map((stage, index) => {
                const stageMeta = getWorkflowModeMeta(stage.mode);
                const isActive = selectedRun?.currentStageId === stage.id;
                const isDone =
                  selectedRun?.stageRuns.find((item) => item.id === stage.id)?.state === "completed";
                return (
                  <div
                    key={stage.id}
                    className={[
                      "rounded-lg border px-3 py-3",
                      isActive
                        ? "border-sky-300 bg-sky-50"
                        : isDone
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-slate-200 bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="text-[10px] font-semibold uppercase text-slate-500">
                      {copy.stage} {index + 1}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-950">{stage.title}</div>
                    <div className="mt-2">
                      <span
                        className={[
                          "rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                          stageMeta.className,
                        ].join(" ")}
                      >
                        {stageMeta.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="text-sm font-semibold text-slate-950">{copy.progress}</div>
            </div>
            <div className="max-h-[280px] space-y-3 overflow-y-auto px-4 py-4">
              {commandMessages.slice(-6).map((message) => (
                <div
                  key={message.id}
                  className={[
                    "max-w-[88%] rounded-lg border px-4 py-3 text-sm leading-7",
                    message.role === "user"
                      ? "ml-auto border-slate-950 bg-slate-950 text-white"
                      : message.error
                        ? "border-rose-200 bg-rose-50 text-rose-900"
                        : "border-slate-200 bg-slate-50 text-slate-700",
                  ].join(" ")}
                >
                  {message.text}
                </div>
              ))}
              {commandLoading ? (
                <div className="max-w-[88%] rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {copy.dispatching}
                </div>
              ) : null}
              {commandMessages.length === 0 && !commandLoading ? (
                <div className="flex min-h-[96px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 text-center text-sm leading-7 text-slate-500">
                  {copy.progressIdle}
                </div>
              ) : null}
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {quickCommands.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => void sendCommand(item)}
                    className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-3">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-slate-500">Attention</div>
            <div className="mt-3 grid gap-2">
              {attentionCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => openApp(card.id === "runtime" ? "runtime_console" : "task_manager")}
                  className={[
                    "rounded-lg border px-3 py-3 text-left transition-colors hover:border-slate-300",
                    commandCenterToneClass(card.tone),
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold opacity-70">{card.label}</div>
                      <div className="mt-1 text-xs leading-5 opacity-65">{card.detail}</div>
                    </div>
                    <div className="text-lg font-semibold">{card.value}</div>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase text-slate-500">
                  Reusable assets
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{copy.deliverables}</div>
              </div>
              <button
                type="button"
                onClick={() => openApp("knowledge_vault")}
                className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copy.openApp}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {commandCenterAssets.map((asset) => (
                <button
                  key={asset}
                  type="button"
                  onClick={() => openApp("knowledge_vault")}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-white"
                >
                  {asset}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-slate-500">{copy.progress}</div>
            <div className="mt-3 space-y-2">
              {executionEvents.slice(0, 4).map((event) => (
                <div key={event.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span
                      className={[
                        "mt-1.5 h-2 w-2 rounded-full",
                        event.tone === "success"
                          ? "bg-emerald-500"
                          : event.tone === "error"
                            ? "bg-rose-500"
                            : "bg-slate-400",
                      ].join(" ")}
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">{event.title}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {event.detail}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
```

- [ ] **Step 3: Fix any compile errors caused by the replacement**

Run: `npm run build`

Expected: no JSX/type errors from the replaced layout.

### Task 4: Restyle Home Shell And Remove Glass Wallpaper Dominance

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css` if a body background adjustment is needed.

- [ ] **Step 1: Change the home root and background classes**

In `Home`, replace the saturated wallpaper overlay block with a calmer neutral canvas:

```tsx
      <div className="absolute inset-0 bg-[#eef1f5]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(241,245,249,0.92))]" />
      <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:96px_96px]" />
```

Do not remove `wallpaperClassName` state yet unless TypeScript reports it unused.

- [ ] **Step 2: Restyle the status bar to match the command center**

Change the status bar shell to:

```tsx
        <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-slate-900 shadow-sm backdrop-blur-xl sm:px-4">
```

Update obvious white text utility classes inside the top bar to slate equivalents while preserving controls and click handlers.

- [ ] **Step 3: Adjust desktop content padding for the new command center**

Change the main content wrapper to keep the command center high on screen:

```tsx
        className="absolute inset-0 z-10 px-3 pb-8 pt-20 sm:px-5 sm:pb-10 sm:pt-20"
```

- [ ] **Step 4: Build**

Run: `npm run build`

Expected: build succeeds or only unrelated pre-existing errors remain.

### Task 5: Verification And Visual QA

**Files:**
- No planned source changes unless verification finds a bug.

- [ ] **Step 1: Run focused helper test**

Run: `node --import ./scripts/register-ts-alias-loader.mjs src/lib/home-command-center.test.mjs`

Expected: all tests print `ok - ...`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: lint passes, or document any unrelated lint tool issue exactly.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: build passes.

- [ ] **Step 4: Start local dev server**

Run: `npm run dev`

Expected: Next dev server starts on port 3000 or reports a different available URL.

- [ ] **Step 5: Browser visual check**

Use the Playwright skill or a browser preview at:

```text
http://127.0.0.1:3000
```

Check:

- Desktop around 1440px: three-column command center is visible and not overlapped.
- Mobile around 390px: regions stack and text does not overflow.
- Opening a shortcut app shows an app window, and clicking the backdrop closes it.
- Spotlight still opens with `Cmd/Ctrl+K`.

- [ ] **Step 6: Commit implementation**

Run:

```bash
git add src/lib/home-command-center.ts src/lib/home-command-center.test.mjs src/app/page.tsx src/app/globals.css
git commit -m "feat: redesign home as command center"
```

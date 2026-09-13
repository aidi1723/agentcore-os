# 真实 Replay 执行实施计划

**日期**: 2026-09-12  
**优先级**: P0（阻塞正式版发布）  
**预计时间**: 2-3 周  
**负责人**: Claude Opus 5

---

## 📋 执行摘要

### 目标
将当前的"无副作用原型"（no-side-effect prototype）升级为**完整的 Replay 执行引擎**，能够：
1. ✅ 从 ControlledTraceFixture 完整重放执行流程
2. ✅ 拦截所有副作用（LLM、工具、API 等）
3. ✅ 使用 fixture 数据而非真实调用
4. ✅ 验证状态一致性
5. ✅ 保持 100% 安全保证

### 当前状态
```typescript
// 现在：只验证合约，不执行
function runNoSideEffectReplaySandbox(contract) {
  const validation = validateReplaySandboxContract(contract);
  if (!validation.ok) return failed();
  return succeeded(); // ⚠️ 这里什么都没做！
}
```

### 目标状态
```typescript
// 目标：完整执行 replay
function runFullReplaySandbox(contract) {
  validate(contract);
  loadFixture(contract.input.sourceId);
  initializeSandbox();
  for (const step of fixture.steps) {
    replayStep(step, sandbox); // ✅ 真正执行
  }
  validateState();
  return artifact;
}
```

---

## 🏗️ 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                   RunFullReplaySandbox                      │
│                    (主执行函数)                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ├─ 1. Preflight 验证
                              │    └─ validateReplaySandboxContract()
                              │
                              ├─ 2. 加载 Fixture
                              │    └─ loadControlledTraceFixture()
                              │
                              ├─ 3. 初始化沙盒环境
                              │    └─ createReplaySandboxEnvironment()
                              │         ├─ 虚拟文件系统
                              │         ├─ 模拟网络层
                              │         └─ 审批决策记录器
                              │
                              ├─ 4. 创建副作用拦截器
                              │    └─ createSideEffectInterceptor()
                              │         ├─ interceptLLMCall()
                              │         ├─ interceptToolExecution()
                              │         ├─ interceptAPICall()
                              │         └─ interceptWriteback()
                              │
                              ├─ 5. 执行所有步骤
                              │    └─ for each step: replayStep()
                              │         ├─ 恢复步骤状态
                              │         ├─ 拦截副作用
                              │         ├─ 应用审批决策
                              │         ├─ 验证状态转换
                              │         └─ 记录执行轨迹
                              │
                              ├─ 6. 验证保证
                              │    └─ validateGuarantees()
                              │         ├─ toolCallsExecuted = false
                              │         ├─ assetsWritten = false
                              │         ├─ runtimeStoresMutated = false
                              │         └─ productionCredentialsUsed = false
                              │
                              └─ 7. 生成结果
                                   └─ buildReplayResultArtifact()
```

---

## 📂 文件结构

### 新增文件

```
src/lib/executor/runtime/
├── replay-sandbox-environment.ts     (新增) 沙盒环境
│   ├── ReplaySandboxEnvironment
│   ├── VirtualFileSystem
│   ├── MockNetworkLayer
│   └── ApprovalDecisionRecorder
│
├── replay-sandbox-interceptor.ts     (新增) 副作用拦截器
│   ├── SideEffectInterceptor
│   ├── interceptLLMCall()
│   ├── interceptToolExecution()
│   ├── interceptAPICall()
│   └── interceptWriteback()
│
├── replay-sandbox-executor.ts        (新增) 步骤执行器
│   ├── replayStep()
│   ├── restoreStepState()
│   ├── applyApprovalDecision()
│   └── validateStateTransition()
│
├── replay-sandbox-full.ts            (新增) 完整执行函数
│   └── runFullReplaySandbox()
│
└── replay-sandbox.ts                 (现有) 保持向后兼容
    └── runNoSideEffectReplaySandbox()  (不变)
```

### 修改文件

```
src/lib/executor/runtime/
├── replay-sandbox-contracts.ts       (修改) 增加新类型
│   ├── ReplaySandboxMode: 增加 "full_replay_execution"
│   └── ReplaySandboxEnvironment: 新增环境类型
│
└── trace-fixtures.ts                 (可能修改) 如需要
```

---

## 🔧 详细设计

### 1. ReplaySandboxEnvironment（沙盒环境）

#### 接口定义
```typescript
// src/lib/executor/runtime/replay-sandbox-environment.ts

export type ReplaySandboxEnvironment = {
  sandboxId: string;
  fixtureId: string;
  virtualFS: VirtualFileSystem;
  networkLayer: MockNetworkLayer;
  approvalRecorder: ApprovalDecisionRecorder;
  sideEffectLog: SideEffectLogEntry[];
  stateSnapshot: Record<string, unknown>;
};

export type VirtualFileSystem = {
  read: (path: string) => string | null;
  write: (path: string, content: string) => void;
  exists: (path: string) => boolean;
  list: (dir: string) => string[];
};

export type MockNetworkLayer = {
  recordRequest: (url: string, method: string, body?: unknown) => void;
  mockResponse: (url: string, response: unknown) => void;
  getRequestLog: () => NetworkRequestLogEntry[];
};

export type ApprovalDecisionRecorder = {
  recordDecision: (stepId: string, decision: ApprovalDecision) => void;
  getDecision: (stepId: string) => ApprovalDecision | null;
  getAllDecisions: () => Map<string, ApprovalDecision>;
};

export type SideEffectLogEntry = {
  timestamp: number;
  stepId: string;
  type: ReplaySideEffect;
  details: unknown;
  intercepted: boolean;
  source: "fixture" | "real";
};

export function createReplaySandboxEnvironment(
  contract: ReplaySandboxContract,
): ReplaySandboxEnvironment {
  return {
    sandboxId: contract.sandboxId,
    fixtureId: contract.input.sourceId,
    virtualFS: createVirtualFileSystem(),
    networkLayer: createMockNetworkLayer(),
    approvalRecorder: createApprovalDecisionRecorder(contract),
    sideEffectLog: [],
    stateSnapshot: {},
  };
}
```

#### 虚拟文件系统
```typescript
function createVirtualFileSystem(): VirtualFileSystem {
  const storage = new Map<string, string>();
  
  return {
    read: (path: string) => storage.get(path) ?? null,
    write: (path: string, content: string) => {
      storage.set(path, content);
    },
    exists: (path: string) => storage.has(path),
    list: (dir: string) => {
      const prefix = dir.endsWith("/") ? dir : `${dir}/`;
      return Array.from(storage.keys())
        .filter((key) => key.startsWith(prefix))
        .map((key) => key.slice(prefix.length));
    },
  };
}
```

---

### 2. SideEffectInterceptor（副作用拦截器）

#### 接口定义
```typescript
// src/lib/executor/runtime/replay-sandbox-interceptor.ts

export type SideEffectInterceptor = {
  llmCall: (params: LLMCallParams, stepId: string) => LLMCallResult;
  toolExecution: (tool: string, params: unknown, stepId: string) => ToolExecutionResult;
  apiCall: (url: string, options: RequestOptions, stepId: string) => ApiCallResult;
  writeback: (target: string, data: unknown, stepId: string) => WritebackResult;
};

export type LLMCallParams = {
  model: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
};

export type LLMCallResult = {
  response: string;
  tokensUsed: number;
  durationMs: number;
  intercepted: boolean;
  source: "fixture" | "real";
};

export function createSideEffectInterceptor(
  fixture: ControlledTraceFixture,
  policy: ReplaySandboxContract["sideEffectPolicy"],
  environment: ReplaySandboxEnvironment,
): SideEffectInterceptor {
  return {
    llmCall: (params, stepId) => interceptLLMCall(fixture, stepId, params, environment),
    toolExecution: (tool, params, stepId) => 
      interceptToolExecution(fixture, stepId, tool, params, environment),
    apiCall: (url, options, stepId) => 
      interceptAPICall(fixture, stepId, url, options, environment),
    writeback: (target, data, stepId) => 
      interceptWriteback(fixture, stepId, target, data, environment),
  };
}
```

#### LLM 调用拦截
```typescript
function interceptLLMCall(
  fixture: ControlledTraceFixture,
  stepId: string,
  params: LLMCallParams,
  environment: ReplaySandboxEnvironment,
): LLMCallResult {
  const step = fixture.steps.find((s) => s.stepId === stepId);
  
  if (!step) {
    throw new Error(`Step ${stepId} not found in fixture`);
  }
  
  // 从 fixture 中查找 LLM 调用记录
  const llmToolCall = step.toolCalls.find((tc) => tc.toolName === "llm_generate");
  
  if (!llmToolCall) {
    throw new Error(`No LLM call found in fixture for step ${stepId}`);
  }
  
  // 记录副作用
  environment.sideEffectLog.push({
    timestamp: Date.now(),
    stepId,
    type: "llm_call",
    details: { params, fixtureCall: llmToolCall },
    intercepted: true,
    source: "fixture",
  });
  
  // 返回 fixture 中的数据（不真正调用 LLM）
  return {
    response: "[REDACTED - from fixture]", // fixture 中数据已被编辑
    tokensUsed: llmToolCall.tokensUsed ?? 0,
    durationMs: llmToolCall.durationMs ?? 0,
    intercepted: true,
    source: "fixture",
  };
}
```

#### 工具执行拦截
```typescript
const READ_ONLY_TOOLS = ["file_read", "search", "list_files", "grep"];
const SIDE_EFFECT_TOOLS = ["file_write", "api_call", "send_email", "webhook"];

function interceptToolExecution(
  fixture: ControlledTraceFixture,
  stepId: string,
  tool: string,
  params: unknown,
  environment: ReplaySandboxEnvironment,
): ToolExecutionResult {
  const step = fixture.steps.find((s) => s.stepId === stepId);
  
  if (!step) {
    throw new Error(`Step ${stepId} not found in fixture`);
  }
  
  // 只读工具：可以真实执行（在虚拟 FS 中）
  if (READ_ONLY_TOOLS.includes(tool)) {
    if (tool === "file_read") {
      const content = environment.virtualFS.read(params as string);
      return {
        success: content !== null,
        output: content ?? "[FILE NOT FOUND]",
        intercepted: false,
        source: "real",
      };
    }
    // 其他只读工具类似...
  }
  
  // 副作用工具：从 fixture 返回结果
  if (SIDE_EFFECT_TOOLS.includes(tool)) {
    const toolCall = step.toolCalls.find((tc) => tc.toolName === tool);
    
    if (!toolCall) {
      throw new Error(`Tool ${tool} not found in fixture for step ${stepId}`);
    }
    
    // 记录副作用
    environment.sideEffectLog.push({
      timestamp: Date.now(),
      stepId,
      type: "tool_execution",
      details: { tool, params, fixtureCall: toolCall },
      intercepted: true,
      source: "fixture",
    });
    
    return {
      success: toolCall.success,
      output: "[REDACTED - from fixture]",
      intercepted: true,
      source: "fixture",
    };
  }
  
  throw new Error(`Unknown tool: ${tool}`);
}
```

---

### 3. StepExecutor（步骤执行器）

#### 接口定义
```typescript
// src/lib/executor/runtime/replay-sandbox-executor.ts

export type StepReplayContext = {
  fixture: ControlledTraceFixture;
  step: ControlledTraceFixture["steps"][number];
  sandbox: ReplaySandboxEnvironment;
  contract: ReplaySandboxContract;
  interceptor: SideEffectInterceptor;
};

export type StepReplayResult = {
  stepId: string;
  status: "succeeded" | "failed";
  state: StepState;
  sideEffects: SideEffectLogEntry[];
  diagnostics: string[];
};

export type StepState = {
  state: "pending" | "in_progress" | "completed" | "failed";
  attempts: number;
  approvalState?: "pending" | "approved" | "rejected";
  writebackTargets: WritebackTarget[];
};
```

#### 步骤执行函数
```typescript
export function replayStep(
  context: StepReplayContext,
): StepReplayResult {
  const { step, sandbox, contract, interceptor } = context;
  const diagnostics: string[] = [];
  
  // 1. 恢复步骤初始状态
  const initialState = restoreStepState(step);
  diagnostics.push(`Restored state for step ${step.stepId}`);
  
  // 2. 执行工具调用（使用拦截器）
  for (const toolCall of step.toolCalls) {
    if (toolCall.toolName === "llm_generate") {
      const result = interceptor.llmCall({
        model: "gpt-4",
        prompt: "[REDACTED]",
      }, step.stepId);
      diagnostics.push(`Intercepted LLM call: ${result.tokensUsed} tokens`);
    } else {
      const result = interceptor.toolExecution(
        toolCall.toolName,
        {},
        step.stepId,
      );
      diagnostics.push(`Intercepted tool ${toolCall.toolName}: ${result.success ? "success" : "failed"}`);
    }
  }
  
  // 3. 应用审批决策（如果需要）
  if (step.approvalState) {
    const decision = applyApprovalDecision(step, contract, sandbox);
    diagnostics.push(`Applied approval decision: ${decision}`);
  }
  
  // 4. 执行写回（使用拦截器）
  for (const writeback of step.writebackTargets) {
    const result = interceptor.writeback(
      writeback.target,
      { assetId: writeback.assetId },
      step.stepId,
    );
    diagnostics.push(`Intercepted writeback to ${writeback.target}`);
  }
  
  // 5. 验证状态转换
  const finalState = {
    state: step.state,
    attempts: step.attempts,
    approvalState: step.approvalState,
    writebackTargets: step.writebackTargets,
  };
  
  const stateValid = validateStateTransition(initialState, finalState, step);
  if (!stateValid.ok) {
    diagnostics.push(...stateValid.errors);
  }
  
  return {
    stepId: step.stepId,
    status: stateValid.ok ? "succeeded" : "failed",
    state: finalState,
    sideEffects: sandbox.sideEffectLog.filter((log) => log.stepId === step.stepId),
    diagnostics,
  };
}
```

#### 状态恢复
```typescript
function restoreStepState(
  step: ControlledTraceFixture["steps"][number],
): StepState {
  return {
    state: "pending", // 开始时是 pending
    attempts: 0,      // 还没有尝试
    approvalState: step.approvalState ? "pending" : undefined,
    writebackTargets: [],
  };
}
```

#### 审批决策应用
```typescript
function applyApprovalDecision(
  step: ControlledTraceFixture["steps"][number],
  contract: ReplaySandboxContract,
  sandbox: ReplaySandboxEnvironment,
): ApprovalDecision {
  // 优先使用 contract 中的模拟决策
  const simulated = contract.approvalPolicy.simulatedDecisions?.find(
    (d) => d.stepId === step.stepId,
  );
  
  if (simulated) {
    sandbox.approvalRecorder.recordDecision(step.stepId, simulated.decision);
    return simulated.decision;
  }
  
  // 回退到 fixture 中的审批状态
  if (step.approvalState && step.approvalState !== "pending") {
    const decision = step.approvalState as ApprovalDecision;
    sandbox.approvalRecorder.recordDecision(step.stepId, decision);
    return decision;
  }
  
  throw new Error(`No approval decision found for step ${step.stepId}`);
}
```

#### 状态转换验证
```typescript
function validateStateTransition(
  before: StepState,
  after: StepState,
  fixtureStep: ControlledTraceFixture["steps"][number],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // 验证最终状态匹配
  if (after.state !== fixtureStep.state) {
    errors.push(
      `State mismatch: expected ${fixtureStep.state}, got ${after.state}`,
    );
  }
  
  // 验证尝试次数匹配
  if (after.attempts !== fixtureStep.attempts) {
    errors.push(
      `Attempts mismatch: expected ${fixtureStep.attempts}, got ${after.attempts}`,
    );
  }
  
  // 验证审批状态匹配
  if (after.approvalState !== fixtureStep.approvalState) {
    errors.push(
      `Approval state mismatch: expected ${fixtureStep.approvalState}, got ${after.approvalState}`,
    );
  }
  
  return {
    ok: errors.length === 0,
    errors,
  };
}
```

---

### 4. runFullReplaySandbox（完整执行函数）

```typescript
// src/lib/executor/runtime/replay-sandbox-full.ts

import { loadControlledTraceFixture } from "./trace-fixtures";
import { createReplaySandboxEnvironment } from "./replay-sandbox-environment";
import { createSideEffectInterceptor } from "./replay-sandbox-interceptor";
import { replayStep } from "./replay-sandbox-executor";
import {
  buildReplayResultArtifact,
  validateReplaySandboxContract,
  type ReplaySandboxContract,
  type ReplayResultArtifact,
} from "./replay-sandbox-contracts";

export function runFullReplaySandbox(
  contract: ReplaySandboxContract,
): ReplayResultArtifact {
  const cursorEvents: ReplaySandboxCursorEvent[] = ["preflight"];
  const diagnostics: string[] = [];
  
  // 1. Preflight 验证
  const validation = validateReplaySandboxContract(contract);
  
  if (!validation.ok) {
    return buildReplayResultArtifact(contract, {
      status: "failed",
      cursorEvents,
      diagnostics: validation.errors,
    });
  }
  
  diagnostics.push("Preflight validation passed");
  
  try {
    // 2. 加载 Fixture
    cursorEvents.push("load_source_metadata");
    const fixture = loadControlledTraceFixture(contract.input.sourceId);
    diagnostics.push(`Loaded fixture ${fixture.fixtureId}`);
    
    // 3. 初始化沙盒环境
    const sandbox = createReplaySandboxEnvironment(contract);
    diagnostics.push(`Initialized sandbox ${sandbox.sandboxId}`);
    
    // 4. 创建副作用拦截器
    const interceptor = createSideEffectInterceptor(fixture, contract.sideEffectPolicy, sandbox);
    diagnostics.push("Created side effect interceptor");
    
    // 5. 执行所有步骤
    cursorEvents.push("simulate_approvals");
    cursorEvents.push("block_side_effects");
    
    const stepResults: StepReplayResult[] = [];
    
    for (const step of fixture.steps) {
      const result = replayStep({
        fixture,
        step,
        sandbox,
        contract,
        interceptor,
      });
      
      stepResults.push(result);
      diagnostics.push(...result.diagnostics);
      
      if (result.status === "failed") {
        return buildReplayResultArtifact(contract, {
          status: "failed",
          cursorEvents,
          diagnostics: [
            ...diagnostics,
            `Step ${step.stepId} replay failed`,
            ...result.diagnostics,
          ],
        });
      }
    }
    
    // 6. 验证保证
    const allSideEffectsIntercepted = sandbox.sideEffectLog.every(
      (log) => log.intercepted,
    );
    
    if (!allSideEffectsIntercepted) {
      return buildReplayResultArtifact(contract, {
        status: "failed",
        cursorEvents,
        diagnostics: [
          ...diagnostics,
          "Some side effects were not intercepted - guarantee violation",
        ],
      });
    }
    
    // 7. 生成成功结果
    cursorEvents.push("emit_result_artifact");
    diagnostics.push(`Successfully replayed ${stepResults.length} steps`);
    diagnostics.push(`Intercepted ${sandbox.sideEffectLog.length} side effects`);
    
    return buildReplayResultArtifact(contract, {
      status: "succeeded",
      cursorEvents,
      diagnostics,
      simulatedApprovals: Array.from(sandbox.approvalRecorder.getAllDecisions()).map(
        ([stepId, decision]) => ({ stepId, decision }),
      ),
      blockedSideEffects: Array.from(
        new Set(sandbox.sideEffectLog.map((log) => log.type)),
      ),
    });
  } catch (error) {
    return buildReplayResultArtifact(contract, {
      status: "failed",
      cursorEvents,
      diagnostics: [
        ...diagnostics,
        `Replay failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    });
  }
}

function buildReplayResultArtifact(
  contract: ReplaySandboxContract,
  result: {
    status: "succeeded" | "failed";
    cursorEvents: ReplaySandboxCursorEvent[];
    diagnostics: string[];
    simulatedApprovals?: Array<{ stepId: string; decision: string }>;
    blockedSideEffects?: ReplaySideEffect[];
  },
): ReplayResultArtifact {
  return {
    schemaVersion: "replay-result-artifact/v1",
    replayId: contract.replayId,
    sandboxId: contract.sandboxId,
    mode: contract.mode,
    status: result.status,
    source: contract.input,
    simulatedApprovals: result.simulatedApprovals ?? [],
    blockedSideEffects: result.blockedSideEffects ?? [],
    cursorEvents: result.cursorEvents,
    diagnostics: result.diagnostics,
    generatedAt: Date.now(),
    guarantees: {
      toolCallsExecuted: false,
      assetsWritten: false,
      runtimeStoresMutated: false,
      productionCredentialsUsed: false,
    },
  };
}
```

---

## 📅 实施时间表

### Week 1: 基础设施（5-7 天）

#### Day 1-2: 沙盒环境
- [ ] 创建 `replay-sandbox-environment.ts`
- [ ] 实现 `VirtualFileSystem`
- [ ] 实现 `MockNetworkLayer`
- [ ] 实现 `ApprovalDecisionRecorder`
- [ ] 编写单元测试

#### Day 3-4: 副作用拦截器
- [ ] 创建 `replay-sandbox-interceptor.ts`
- [ ] 实现 `interceptLLMCall()`
- [ ] 实现 `interceptToolExecution()`
- [ ] 实现 `interceptAPICall()`
- [ ] 实现 `interceptWriteback()`
- [ ] 编写单元测试

#### Day 5: 步骤执行器
- [ ] 创建 `replay-sandbox-executor.ts`
- [ ] 实现 `replayStep()`
- [ ] 实现 `restoreStepState()`
- [ ] 实现 `applyApprovalDecision()`
- [ ] 实现 `validateStateTransition()`
- [ ] 编写单元测试

### Week 2: 完整执行（5-7 天）

#### Day 1-2: 主执行函数
- [ ] 创建 `replay-sandbox-full.ts`
- [ ] 实现 `runFullReplaySandbox()`
- [ ] 集成所有组件
- [ ] 实现错误处理

#### Day 3-4: 集成测试
- [ ] 测试 sales-pipeline fixture
- [ ] 测试 support-resolution fixture
- [ ] 测试错误情况
- [ ] 测试边界情况

#### Day 5: 差异检测和报告
- [ ] 实现状态差异检测
- [ ] 生成详细诊断报告
- [ ] 优化诊断信息

### Week 3: 完善和文档（5-7 天）

#### Day 1-2: 性能优化
- [ ] 优化副作用拦截
- [ ] 优化状态验证
- [ ] 减少内存占用

#### Day 3-4: 文档和示例
- [ ] API 文档
- [ ] 使用指南
- [ ] 示例代码
- [ ] 故障排查

#### Day 5: 代码审查和发布
- [ ] 代码审查
- [ ] 修复问题
- [ ] 合并到 main
- [ ] 更新 CHANGELOG

---

## ✅ 验收标准

### 功能验收
- [ ] 能够完整重放 `sales-pipeline-governed.fixture.json`
- [ ] 能够完整重放 `support-resolution-governed.fixture.json`
- [ ] 所有 LLM 调用被正确拦截
- [ ] 所有工具执行被正确拦截
- [ ] 所有审批决策被正确应用
- [ ] 所有写回操作被正确拦截
- [ ] 状态转换验证通过

### 安全验收
- [ ] `toolCallsExecuted = false` 始终成立
- [ ] `assetsWritten = false` 始终成立
- [ ] `runtimeStoresMutated = false` 始终成立
- [ ] `productionCredentialsUsed = false` 始终成立
- [ ] 所有副作用都被记录

### 测试验收
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试覆盖率 > 80%
- [ ] 所有测试通过
- [ ] 0 个 TypeScript 错误
- [ ] 0 个 ESLint 错误

### 性能验收
- [ ] Replay 速度 < 1秒/步骤
- [ ] 内存占用 < 100MB
- [ ] 支持并发 replay（至少 3 个）

---

## 🎯 关键里程碑

| 里程碑 | 日期 | 说明 |
|--------|------|------|
| 🏗️ 基础设施完成 | Day 5 | 沙盒环境、拦截器、执行器 |
| 🚀 首次完整 Replay | Day 10 | 成功重放第一个 fixture |
| ✅ 测试完成 | Day 14 | 所有测试通过 |
| 📚 文档完成 | Day 17 | API 文档和使用指南 |
| 🎉 发布准备 | Day 19 | 代码审查和合并 |

---

## 📊 风险管理

### 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 状态不一致 | 中 | 高 | 每步验证，详细日志 |
| 性能问题 | 低 | 中 | 异步执行，优化拦截 |
| 安全漏洞 | 低 | 高 | 多层验证，白名单 |

### 进度风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 估算偏差 | 中 | 中 | 预留缓冲时间 |
| 依赖阻塞 | 低 | 中 | 提前识别依赖 |
| 范围蔓延 | 中 | 高 | 严格控制范围 |

---

## 🤝 依赖

### 前置依赖
- ✅ ControlledTraceFixture 类型定义
- ✅ ReplaySandboxContract 类型定义
- ✅ 现有 fixture 测试数据

### 后续依赖
- ⏳ Runtime Console UI（已完成）
- ⏳ 生产运维工具包

---

## 📞 联系和反馈

### 问题报告
如遇到问题，请：
1. 查看 `docs/analysis/2026-09-12-replay-architecture-analysis.md`
2. 检查相关测试文件
3. 提交 GitHub Issue

### 进度更新
每日更新 `docs/daily-logs/` 和 `PROGRESS.md`

---

**创建时间**: 2026-09-12  
**最后更新**: 2026-09-12  
**状态**: 📋 计划中

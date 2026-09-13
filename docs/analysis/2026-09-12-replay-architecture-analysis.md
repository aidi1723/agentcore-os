# Replay 架构深度分析

**日期**: 2026-09-12  
**分析师**: Claude Opus 5  
**目标**: 理解现有 Replay 架构，为真实 Replay 功能完善做准备

---

## 📋 执行摘要

### 当前状态
- ✅ **基础框架完整**: Replay 沙盒框架已建立
- ⚠️ **功能不完整**: 目前只是"无副作用原型"（no-side-effect prototype）
- ⚠️ **缺乏真实性**: 外部调用未真实 replay，只是验证合约

### 核心问题
1. **不执行真实操作**: 当前 replay 只验证合约，不真正执行步骤
2. **缺少状态重放**: 无法重放完整的执行状态
3. **外部调用模拟**: LLM 调用、工具执行等都是模拟的

### 改进目标
将 "contract validation" 升级为 "full replay execution"

---

## 🏗️ 架构概览

### 核心组件

```
replay-sandbox-contracts.ts     定义 Replay 合约类型和验证规则
├── ReplaySandboxContract       Replay 输入合约
├── ReplayResultArtifact        Replay 输出结果
├── ReplaySandboxGuarantees     安全保证
└── 验证函数                     合约验证逻辑

replay-sandbox.ts               执行 Replay 沙盒
└── runNoSideEffectReplaySandbox()  当前唯一的执行函数

trace-replay.ts                 Trace Fixture 重放
└── replayControlledTraceFixture()  验证 fixture 完整性

replay-sandbox-fixture-contract.ts  从 Fixture 构建 Contract
└── buildReplaySandboxContractFromFixture()  转换逻辑
```

---

## 🔍 详细分析

### 1. ReplaySandboxContract（Replay 合约）

#### 结构
```typescript
type ReplaySandboxContract = {
  replayId: string;              // Replay 唯一标识
  sandboxId: string;             // 沙盒唯一标识
  mode: "contract_validation" | "no_side_effect_prototype";
  
  input: {
    kind: ReplayInputKind;       // 输入类型
    sourceId: string;            // 源 ID
    playbookId: string;          // Playbook ID
    playbookVersion: string;     // Playbook 版本
    scenarioId: string;          // 场景 ID
    generatedAt: number;         // 生成时间
    governanceMode: string;      // 治理模式
    redactionBoundary: "required";
  };
  
  credentialPolicy: {
    mode: ReplayCredentialMode;  // 凭证模式
  };
  
  approvalPolicy: {
    mode: ReplayApprovalMode;    // 审批模式
    simulatedDecisions?: Array<...>;  // 模拟决策
  };
  
  storePolicy: {
    mode: ReplayStoreMode;       // 存储模式
    requestedStores: ReplayStoreAccess[];
  };
  
  sideEffectPolicy: {
    allowedOutput: "replay_result_artifact";
    blocked: ReplaySideEffect[]; // 被阻止的副作用
  };
};
```

#### 输入类型（ReplayInputKind）
- `governed_artifact` - 受治理的产物
- `committed_fixture` - 已提交的 fixture（✅ 当前使用）
- `sandbox_snapshot` - 沙盒快照
- `raw_controlled_run` - 原始受控运行（🚫 被禁止）

#### 凭证模式（ReplayCredentialMode）
**安全模式**（允许）:
- `none` - 无凭证
- `fake` - 假凭证
- `fixture` - Fixture 中的凭证
- `replay_scoped` - Replay 作用域凭证

**危险模式**（禁止）:
- `live_api_key` - 真实 API 密钥
- `bearer_token` - Bearer 令牌
- `connector_credential` - 连接器凭证
- `user_session` - 用户会话
- `production_account` - 生产账户
- `ambient` - 环境凭证

#### 审批模式（ReplayApprovalMode）
**安全模式**（允许）:
- `fixture_derived` - 从 fixture 派生
- `simulated` - 模拟审批（✅ 当前使用）
- `require_record_only` - 仅记录模式

**危险模式**（禁止）:
- `live_operator` - 真实操作员
- `production_approval_store` - 生产审批存储

#### 副作用类型（ReplaySideEffect）
```typescript
type ReplaySideEffect =
  | "llm_call"                    // LLM 调用
  | "tool_execution"              // 工具执行
  | "api_route_call"              // API 路由调用
  | "connector_call"              // 连接器调用
  | "webhook"                     // Webhook
  | "email"                       // 邮件
  | "notification"                // 通知
  | "runtime_store_write"         // 运行时存储写入
  | "business_asset_write"        // 业务资产写入
  | "file_write_outside_replay_artifact"  // 文件写入
```

---

### 2. runNoSideEffectReplaySandbox（执行函数）

#### 当前实现
```typescript
export function runNoSideEffectReplaySandbox(
  contract: ReplaySandboxContract,
): ReplayResultArtifact {
  // 1. 验证合约
  const validation = validateReplaySandboxContract(contract);
  
  if (!validation.ok) {
    return buildNoSideEffectReplayResultArtifact(contract, {
      status: "failed",
      cursorEvents: ["preflight"],
      diagnostics: validation.errors,
    });
  }
  
  // 2. 返回成功（⚠️ 这里没有真正执行任何操作！）
  return buildNoSideEffectReplayResultArtifact(contract, {
    status: "succeeded",
    cursorEvents: successfulReplayCursorEvents,
    diagnostics: ["Replay sandbox preflight accepted"],
  });
}
```

#### 问题分析
1. **只验证不执行**: 函数名就说明了 "no side effect"
2. **缺少执行逻辑**: 没有加载 fixture、没有执行步骤、没有状态重放
3. **只是合约检查**: 相当于"预检"，不是真正的 replay

#### Cursor Events（执行阶段）
```typescript
const successfulReplayCursorEvents = [
  "preflight",              // 预检（✅ 已实现）
  "load_source_metadata",   // 加载源元数据（❌ 未实现）
  "simulate_approvals",     // 模拟审批（❌ 未实现）
  "block_side_effects",     // 阻止副作用（❌ 未实现）
  "emit_result_artifact",   // 输出结果（❌ 未实现）
];
```

---

### 3. ReplayResultArtifact（输出结果）

#### 结构
```typescript
type ReplayResultArtifact = {
  schemaVersion: "replay-result-artifact/v1";
  replayId: string;
  sandboxId: string;
  mode: "contract_validation" | "no_side_effect_prototype";
  status: "succeeded" | "failed";
  source: {...};              // 输入信息
  simulatedApprovals: [...];  // 模拟的审批决策
  blockedSideEffects: [...];  // 被阻止的副作用
  cursorEvents: [...];        // 执行阶段
  diagnostics: string[];      // 诊断信息
  generatedAt: number;
  guarantees: {               // 安全保证
    toolCallsExecuted: false;
    assetsWritten: false;
    runtimeStoresMutated: false;
    productionCredentialsUsed: false;
  };
};
```

#### 安全保证（Guarantees）
所有保证都必须是 `false`，确保：
- ✅ 没有执行工具调用
- ✅ 没有写入资产
- ✅ 没有修改运行时存储
- ✅ 没有使用生产凭证

---

### 4. replayControlledTraceFixture（Fixture 重放）

#### 功能
验证 ControlledTraceFixture 的完整性和正确性

#### 验证项
1. **Playbook 版本匹配**: fixture 版本 === 当前 playbook 版本
2. **场景 ID 匹配**: fixture scenarioId === playbook scenarioId
3. **步骤顺序匹配**: fixture 步骤 === playbook 步骤
4. **审批状态完整**: 需要审批的步骤必须有审批状态
5. **写回目标完整**: 所有写回目标必须存在
6. **完成步骤有尝试记录**: completed 状态的步骤必须有 attempts > 0
7. **审批状态正确**: 完成的审批步骤必须是 "approved"
8. **稳定元数据完整**: writebackTargets 必须有 assetId、sourceKey、workflowRunId

#### 输出
```typescript
type ControlledTraceReplayReport = {
  ok: boolean;
  fixtureId: string;
  playbookId: string;
  checkedStepIds: string[];
  errors: string[];
  warnings: string[];
  diagnostics: {...};
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};
```

---

## 🎯 改进方案设计

### 问题定义
**当前**: 只验证合约，不执行真实操作  
**目标**: 完整重放 fixture，包括状态、决策和副作用（受控）

### 改进阶段

#### 阶段 1: 完善沙盒隔离（1-2 天）
1. **增强合约验证**
   - 更严格的副作用检查
   - 更完善的凭证隔离
   - 更细粒度的存储访问控制

2. **增加隔离层**
   - 虚拟文件系统（用于 file_write）
   - 模拟网络层（用于 api_call）
   - 审批决策记录器（用于 approval_policy）

#### 阶段 2: 实现真实 Replay 执行（3-5 天）
1. **创建新的执行函数**
   ```typescript
   export function runFullReplaySandbox(
     contract: ReplaySandboxContract,
   ): ReplayResultArtifact {
     // 1. Preflight 验证（复用现有）
     // 2. Load source metadata（新增）
     // 3. Initialize sandbox environment（新增）
     // 4. Execute steps with fixture data（新增）
     // 5. Simulate approvals（新增）
     // 6. Capture all side effects（新增）
     // 7. Validate guarantees（新增）
     // 8. Emit result artifact（增强）
   }
   ```

2. **步骤执行器**
   ```typescript
   type StepReplayContext = {
     fixture: ControlledTraceFixture;
     step: ControlledTraceFixture["steps"][number];
     sandbox: ReplaySandboxEnvironment;
     contract: ReplaySandboxContract;
   };
   
   function replayStep(context: StepReplayContext): StepReplayResult {
     // 从 fixture 恢复步骤状态
     // 模拟 LLM 调用（使用 fixture 中的响应）
     // 模拟工具执行（使用 fixture 中的结果）
     // 应用审批决策（从 contract 或 fixture）
     // 记录所有副作用
     // 验证状态转换
   }
   ```

3. **副作用拦截器**
   ```typescript
   type SideEffectInterceptor = {
     llmCall: (params: LLMCallParams) => LLMCallResult;
     toolExecution: (params: ToolExecutionParams) => ToolExecutionResult;
     apiRouteCall: (params: ApiCallParams) => ApiCallResult;
     // ... 其他副作用类型
   };
   
   function createSideEffectInterceptor(
     fixture: ControlledTraceFixture,
     policy: ReplaySandboxContract["sideEffectPolicy"],
   ): SideEffectInterceptor {
     // 创建拦截器，使用 fixture 数据或抛出错误
   }
   ```

#### 阶段 3: 状态完整重放（2-3 天）
1. **状态快照系统**
   - 每个步骤的前后状态
   - 审批决策的时间点
   - 副作用的执行顺序

2. **差异检测**
   - 比较 replay 结果与 fixture
   - 识别状态不一致
   - 生成差异报告

#### 阶段 4: 测试和文档（2-3 天）
1. **全面测试**
   - 单元测试（每个组件）
   - 集成测试（完整流程）
   - 边界测试（异常情况）

2. **文档完善**
   - API 文档
   - 使用指南
   - 故障排查

---

## 📊 技术挑战

### 挑战 1: LLM 调用重放
**问题**: LLM 调用是非确定性的，即使相同输入也可能不同输出

**解决方案**:
1. 从 fixture 中提取原始 LLM 响应
2. 在 replay 时直接返回 fixture 响应，不真正调用 LLM
3. 记录 "llm_call" 作为被拦截的副作用

**实现**:
```typescript
function interceptLLMCall(
  fixture: ControlledTraceFixture,
  stepId: string,
  callIndex: number,
): LLMCallResult {
  const step = fixture.steps.find(s => s.stepId === stepId);
  const llmCall = step?.llmCalls?.[callIndex];
  
  if (!llmCall) {
    throw new Error(`LLM call ${callIndex} not found in fixture for step ${stepId}`);
  }
  
  // 返回 fixture 中记录的响应
  return {
    response: llmCall.response,
    metadata: llmCall.metadata,
    intercepted: true,
    source: "fixture",
  };
}
```

### 挑战 2: 工具执行重放
**问题**: 工具执行可能有副作用（文件写入、API 调用等）

**解决方案**:
1. 分类工具：只读 vs 有副作用
2. 只读工具：可以真实执行（如文件读取）
3. 有副作用工具：从 fixture 返回结果

**实现**:
```typescript
const readOnlyTools = ["file_read", "search", "list_files"];
const sideEffectTools = ["file_write", "api_call", "send_email"];

function interceptToolExecution(
  tool: string,
  params: unknown,
  fixture: ControlledTraceFixture,
  stepId: string,
): ToolExecutionResult {
  if (readOnlyTools.includes(tool)) {
    // 真实执行只读工具
    return executeToolSafely(tool, params);
  }
  
  if (sideEffectTools.includes(tool)) {
    // 从 fixture 返回结果
    return getToolResultFromFixture(fixture, stepId, tool);
  }
  
  throw new Error(`Unknown tool: ${tool}`);
}
```

### 挑战 3: 审批决策重放
**问题**: 审批决策依赖人工输入

**解决方案**:
1. 使用 contract 中的 simulatedDecisions
2. 或从 fixture 中的 approvalState 恢复
3. 验证决策与 fixture 一致

**实现**:
```typescript
function getApprovalDecision(
  stepId: string,
  contract: ReplaySandboxContract,
  fixture: ControlledTraceFixture,
): ApprovalDecision {
  // 优先使用 contract 中的模拟决策
  const simulated = contract.approvalPolicy.simulatedDecisions?.find(
    d => d.stepId === stepId
  );
  
  if (simulated) {
    return simulated.decision;
  }
  
  // 回退到 fixture 中的审批状态
  const step = fixture.steps.find(s => s.stepId === stepId);
  if (step?.approvalState) {
    return step.approvalState;
  }
  
  throw new Error(`No approval decision found for step ${stepId}`);
}
```

### 挑战 4: 状态一致性
**问题**: Replay 状态必须与 fixture 状态完全一致

**解决方案**:
1. 在每个步骤后验证状态
2. 记录状态差异
3. 允许"预期差异"（如时间戳）

**实现**:
```typescript
function validateStepState(
  replayState: StepState,
  fixtureState: StepState,
): StateValidationResult {
  const differences = [];
  
  // 忽略时间戳差异
  const ignoredFields = ["timestamp", "generatedAt", "replayId"];
  
  for (const [key, value] of Object.entries(fixtureState)) {
    if (ignoredFields.includes(key)) continue;
    
    if (JSON.stringify(value) !== JSON.stringify(replayState[key])) {
      differences.push({
        field: key,
        expected: value,
        actual: replayState[key],
      });
    }
  }
  
  return {
    ok: differences.length === 0,
    differences,
  };
}
```

---

## 🔧 实施计划

### Week 1: 基础设施（5-7 天）
**Day 1-2**: 沙盒隔离增强
- [ ] 设计隔离层架构
- [ ] 实现虚拟文件系统
- [ ] 实现模拟网络层
- [ ] 实现审批决策记录器

**Day 3-4**: 副作用拦截器
- [ ] 设计拦截器接口
- [ ] 实现 LLM 调用拦截
- [ ] 实现工具执行拦截
- [ ] 实现 API 调用拦截

**Day 5**: 状态管理
- [ ] 设计状态快照格式
- [ ] 实现状态捕获
- [ ] 实现状态恢复

### Week 2: 执行引擎（5-7 天）
**Day 1-2**: 步骤执行器
- [ ] 实现 `replayStep()` 函数
- [ ] 从 fixture 恢复步骤状态
- [ ] 应用审批决策
- [ ] 记录副作用

**Day 3-4**: 完整执行
- [ ] 实现 `runFullReplaySandbox()` 函数
- [ ] 集成所有组件
- [ ] 实现 cursor events
- [ ] 生成 ReplayResultArtifact

**Day 5**: 差异检测
- [ ] 实现状态比较
- [ ] 生成差异报告
- [ ] 处理预期差异

### Week 3: 测试和文档（5-7 天）
**Day 1-2**: 单元测试
- [ ] 测试隔离层
- [ ] 测试拦截器
- [ ] 测试步骤执行

**Day 3-4**: 集成测试
- [ ] 端到端 replay 测试
- [ ] 异常情况测试
- [ ] 性能测试

**Day 5**: 文档
- [ ] API 文档
- [ ] 使用指南
- [ ] 架构文档

---

## 📈 成功指标

### 功能指标
- [ ] 能够完整重放所有 fixture
- [ ] 所有副作用都被正确拦截
- [ ] 状态一致性验证通过率 > 95%
- [ ] 安全保证 100% 满足

### 性能指标
- [ ] Replay 速度 < 1秒/步骤
- [ ] 内存占用 < 100MB
- [ ] 支持并发 replay

### 质量指标
- [ ] 单元测试覆盖率 > 90%
- [ ] 集成测试覆盖率 > 80%
- [ ] 0 个已知安全漏洞

---

## 🚧 风险评估

### 高风险
1. **安全保证失效**: 如果隔离不够严格，可能导致真实副作用
   - **缓解**: 多层验证，白名单机制

2. **状态不一致**: Replay 状态与 fixture 不匹配
   - **缓解**: 每步验证，详细日志

### 中风险
3. **性能问题**: 大型 fixture replay 太慢
   - **缓解**: 异步执行，并行化

4. **兼容性问题**: 旧 fixture 格式不支持
   - **缓解**: 版本检测，自动迁移

### 低风险
5. **文档不足**: 用户不知道如何使用
   - **缓解**: 详细文档，示例代码

---

## 📚 参考资料

### 相关文件
- `src/lib/executor/runtime/replay-sandbox.ts`
- `src/lib/executor/runtime/replay-sandbox-contracts.ts`
- `src/lib/executor/runtime/trace-replay.ts`
- `src/lib/executor/runtime/replay-sandbox-fixture-contract.ts`

### 测试文件
- `src/__tests__/lib/executor/runtime/replay-sandbox.test.ts`
- `src/__tests__/lib/executor/runtime/trace-replay.test.ts`

### Fixture 示例
- `src/__tests__/fixtures/controlled-traces/`

---

## 🎯 下一步行动

### 立即可做
1. **深入阅读 fixture 结构**
   - 理解 ControlledTraceFixture 格式
   - 查看真实 fixture 示例
   - 理解步骤状态转换

2. **设计隔离层**
   - 绘制架构图
   - 定义接口
   - 确定技术选型

### 本周计划
1. 完成隔离层设计和实现
2. 实现副作用拦截器原型
3. 编写初步测试

---

**分析完成时间**: 2026-09-12  
**预计开发时间**: 2-3 周  
**复杂度**: 高  
**优先级**: P0（阻塞正式版发布）

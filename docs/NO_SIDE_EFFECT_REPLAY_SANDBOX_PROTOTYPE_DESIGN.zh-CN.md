# No-Side-Effect Replay Sandbox Prototype Design

Last updated: 2026-07-06

## 1. Purpose

本文档定义最小 no-side-effect replay sandbox prototype。

Prototype 只能消费已经通过 `validateReplaySandboxContract()` 的 `ReplaySandboxContract`，只能输出 replay result artifact。

Prototype 不允许：

- replay LLM output；
- execute tools；
- call API routes；
- read runtime stores；
- write runtime stores；
- write business assets；
- change Runtime Console behavior。

## 2. Current Preconditions

已完成：

- real replay boundary guide；
- replay sandbox contract types；
- `validateReplaySandboxContract()`；
- `buildNoSideEffectReplayResultArtifact()`；
- `src/lib/executor/runtime/replay-sandbox.ts`；
- `runNoSideEffectReplaySandbox()`；
- no-side-effect contract / prototype tests in `test:controlled-runtime`。

仍未实现：

- LLM replay；
- tool replay；
- API route replay；
- store snapshot replay；
- business asset replay；
- production replay。

## 3. Module Boundary

当前 implementation 已新增：

```text
src/lib/executor/runtime/replay-sandbox.ts
```

模块导出：

```ts
runNoSideEffectReplaySandbox(contract: ReplaySandboxContract): ReplayResultArtifact
```

边界要求：

- `replay-sandbox.ts` 必须独立于 `trace-replay.ts`。
- `trace-replay.ts` 继续只负责 metadata fixture replay。
- `replay-sandbox.ts` 只负责 replay-local artifact generation。
- 不允许把 sandbox prototype 接入 executor、route、Runtime Console 或 store。

## 4. Input Contract

Prototype 只接受：

- `ReplaySandboxContract`

Prototype 不接受：

- raw controlled run records；
- governed trace artifacts；
- governed fixtures；
- workflow run ids；
- asset ids；
- route request objects；
- runtime store handles。

调用方必须先创建 contract，再调用 prototype。

## 5. Preflight

prototype 的第一步必须是：

```ts
const validation = validateReplaySandboxContract(contract);
```

如果 validation 失败，prototype 返回 failure replay result artifact。

Failure artifact 行为：

- status 为 failed / invalid contract；
- diagnostics 包含 validation errors；
- cursor 不超过 `preflight`；
- 不做 contract 之外的 approval simulation；
- 不产生 side-effect attempts；
- 不因普通 unsafe contract input 抛异常。

这样调用方可以读取 failure artifact，而不是通过异常或半执行状态判断失败。

## 6. Replay-Local State

prototype 可以拥有：

- replay id；
- sandbox id；
- cursor events；
- source provenance；
- simulated approvals；
- blocked side effects；
- diagnostics；
- replay result artifact。

prototype 不允许拥有或引用：

- controlled execution store；
- approval store；
- workflow run store；
- draft store；
- sales asset store；
- support asset store；
- knowledge asset store；
- Runtime Console state。

## 7. Cursor Events

第一版 prototype 应只记录 replay-local cursor events：

- `preflight`；
- `load_source_metadata`；
- `simulate_approvals`；
- `block_side_effects`；
- `emit_result_artifact`。

cursor event 不是 playbook step replay。

禁止写成：

- `intake_replayed`；
- `qualify_replayed`；
- `writeback_replayed`；
- 任何暗示业务步骤已经重新执行的事件。

## 8. Approval Simulation

Approval simulation 是 metadata-only。

允许：

- 将 contract 中的 simulated decisions 复制到 artifact；
- 记录某一步生产执行时需要 approval；
- 对缺失 simulated approval decision 添加 diagnostic。

禁止：

- 创建 durable approval；
- 调用 approval API；
- 请求 live operator approval；
- 修改 production approval state；
- 把 simulated approval 当成真实 operator decision。

## 9. Side-Effect Blocking

Side effects 必须在执行前被阻断，而不是先尝试再标记失败。

prototype 可以从 contract 和 side-effect policy 派生：

- blocked LLM calls；
- blocked tool execution；
- blocked API route calls；
- blocked connector calls；
- blocked webhooks / emails / notifications；
- blocked runtime store writes；
- blocked business asset writes；
- blocked file writes outside replay artifacts。

prototype 不允许调用真实 tool、route、connector、webhook、email、notification、file writer、store writer 或 asset writer 来证明 blocking。

## 10. Result Artifact

prototype 的唯一输出是 replay result artifact。

artifact 应包含：

- schema version；
- replay id；
- sandbox id；
- source provenance；
- replay mode；
- status；
- cursor events；
- simulated approvals；
- blocked side effects；
- diagnostics；
- no-side-effect guarantees。

artifact 不得伪装成：

- controlled run record；
- writeback receipt；
- workflow run；
- draft；
- sales / support / knowledge business asset。

## 11. Implementation Stop Conditions

如果 implementation plan 需要以下任意能力，停止 implementation：

- LLM replay；
- tool execution；
- route calls；
- runtime store reads；
- runtime store writes；
- business asset writes；
- fixture JSON changes；
- Runtime Console UI changes；
- raw governed artifact payload recovery。

这些能力属于后续单独设计，不属于最小 no-side-effect prototype。

## 12. Current Implementation And Next Phase

当前 prototype 已证明：

- unsafe contract 在执行前返回 failed replay result artifact；
- safe contract 只输出 replay result artifact；
- result artifact 不像 controlled run、writeback receipt 或 business asset；
- guarantees 仍保持：
  - `toolCallsExecuted: false`
  - `assetsWritten: false`
  - `runtimeStoresMutated: false`
  - `productionCredentialsUsed: false`

下一阶段允许进入：

**Catalog-Level Replay Sandbox Report**

该阶段可以新增纯 report helper，把 committed fixture catalog 跑过 `fixture -> ReplaySandboxContract -> replay result artifact`。

该阶段仍禁止 LLM replay、tool execution、route calls、runtime store reads/writes、business asset writes、fixture JSON changes 和 raw governed artifact payload recovery。

# Real Replay Boundary Design

Last updated: 2026-07-06

## 1. Purpose

本文档定义 AgentCore OS 未来 real replay 的边界。

当前 governed fixture replay 是 metadata-only：它只用 committed governed fixture metadata 校验当前 controlled playbook contract。它不重放 LLM 输出、不执行工具、不调用 API route、不读写 runtime store、不写业务资产。

在 real replay 进入任何代码实现前，必须先明确：

- replay sandbox ownership；
- credential isolation；
- approval simulation；
- store isolation；
- side-effect blocking；
- replay result artifact ownership；
- artifact / fixture provenance；
- stop conditions；
- verification gates。

## 2. Current Status

已实现：

- governed trace artifact export；
- governed fixture generation and validation；
- committed sales / support governed fixtures；
- pure metadata fixture replay；
- fixture catalog report；
- human-readable fixture replay summary；
- fixture refresh workflow；
- replay contract guide；
- CI gate guide；
- catalog coverage guide；
- governed trace operational runbook。

未实现：

- LLM replay；
- tool replay；
- tool simulation；
- API route replay；
- store snapshot replay；
- business asset replay；
- production replay。

## 3. Threat Model

real replay 如果能做到以下任何一项，就不安全：

- 访问生产凭据；
- 调用 live connector、API、route、webhook、email 或 notification system；
- 修改 controlled run、approval、workflow、draft、sales、support 或 knowledge store；
- 创建业务资产；
- 把 redacted governed artifact 重新扩写成虚构 raw content；
- 绕过生产 approval state machine；
- 产出看起来像 approved controlled run、真实 writeback receipt 或业务资产的结果。

real replay 的默认姿态必须是拒绝副作用，而不是事后审计副作用。

## 4. Allowed Replay Inputs

允许的 replay input：

- 由 Runtime Console `复制脱敏 Trace` 或 local trace artifact route 导出的 governed trace artifact；
- explicit fixture catalog 中列出的 committed governed fixture；
- 未来经过审查的 replay sandbox snapshot。

必须保留的 provenance：

- `sourceRunId`；
- `playbookId`；
- `playbookVersion`；
- `scenarioId`；
- generated / exported timestamp；
- fixture id（当 replay committed fixture 时）；
- governance mode；
- redaction flags。

必须停止的输入：

- raw controlled run record；
- 未脱敏 step input/output、tool output、approval feedback、audit message 或 error payload；
- 缺少 source identity；
- 指向未知 playbook；
- playbook version 已漂移但未经过人工审查；
- replay 需要 governance 已经移除的 raw text。

## 5. Replay Sandbox Ownership

未来 replay sandbox 只拥有 replay-local state。

sandbox 可以拥有：

- replay session id；
- replay-local step state；
- replay-local simulated approval decisions；
- replay-local blocked side-effect log；
- replay diagnostics；
- replay result artifact。

sandbox 不拥有：

- controlled execution store；
- approval store；
- workflow run store；
- draft store；
- sales asset store；
- support asset store；
- knowledge asset store；
- Runtime Console operational state。

Stop condition：

- replay 需要修改生产 store 才能完成；
- replay output 需要写入业务资产层才算成功；
- replay sandbox state 与真实 controlled run state 无法区分。

## 6. Credential Isolation

replay 默认没有生产凭据。

允许的 credential class：

- fake credentials for contract tests；
- 无法访问外部系统的 fixture credentials；
- 只为 replay sandbox 创建的 replay-scoped credentials。

禁止的 credential class：

- live API keys；
- bearer tokens；
- connector credentials；
- user sessions；
- production account credentials；
- ambient credentials inherited from the operator environment。

Stop condition：

- 任何 replay step 需要 live credential；
- replay 依赖隐藏的用户 session；
- replay 无法证明凭据只能触达 sandbox 或 fake endpoint。

## 7. Approval Simulation

replay 中的 approval 只能来自 fixture/artifact metadata 或 replay-local simulation。

replay 可以：

- 读取 governed artifact / fixture 中记录的 approval state；
- 生成 replay-local simulated approval decision；
- 记录某一步在生产执行中是否会需要 approval；
- 把 simulated decision 写进 replay result artifact。

replay 不允许：

- 创建 durable approval record；
- 修改生产 approval state；
- 将生产 approval 标记为 approved / rejected；
- 绕过生产 approval gate；
- 要求操作者为了 replay 去批准业务状态修改。

Stop condition：

- replay 需要 live approval 才能修改业务状态；
- replay approval simulation 会影响生产 approval store；
- replay 无法区分 simulated approval 和真实 operator decision。

## 8. Store Isolation

replay 只能读取 replay input 和 replay sandbox snapshot。

replay 不允许直接读写：

- controlled run store；
- approval store；
- workflow run store；
- draft store；
- sales asset store；
- support asset store；
- knowledge asset store。

replay result artifact 必须与 runtime store 分离。

Stop condition：

- replay 需要直接访问 runtime store；
- replay 需要将结果写回 workflow / draft / sales / support / knowledge asset；
- replay 依赖当前生产 store 中的可变状态判断是否通过。

## 9. Side-Effect Blocking

未来 prototype 的默认模式必须是 no-side-effect。

禁止的 side effect：

- LLM calls；
- tool execution；
- API route calls；
- connector calls；
- webhooks；
- email / notification sends；
- file writes outside replay artifacts；
- runtime store mutation；
- business asset writes；
- durable approval mutation。

Stop condition：

- replay path 的 side effects 无法在启动前列举；
- replay 只能通过事后日志判断是否发生副作用；
- replay 需要调用真实 tool 或 route 才能完成；
- replay 需要写除 replay result artifact 以外的文件。

## 10. Replay Result Artifact Ownership

replay output 属于 replay result artifact，不属于业务资产。

replay result artifact 应记录：

- replay id；
- replay mode；
- source artifact / fixture provenance；
- playbook id and version；
- scenario id；
- sandbox id；
- simulated approval decisions；
- blocked side-effect attempts；
- diagnostics；
- no-side-effect guarantees；
- generated timestamp。

replay result artifact 不应被当作：

- controlled run record；
- approved writeback receipt；
- sales / support / knowledge asset；
- workflow run；
- draft。

Stop condition：

- replay output 会被操作者误认为真实受控执行结果；
- replay result 缺少 source provenance；
- replay result 需要进入业务资产层才有价值；
- replay result 无法证明 side effects 被阻断。

## 11. Artifact And Fixture Provenance

每一个 replay result 都必须能追溯到 source governed artifact 或 committed governed fixture。

规则：

- redacted fields 保持 redacted；
- replay 不得凭空补回 raw payload；
- fixture 不是新的 truth source，当前 playbook catalog 仍是 contract source；
- 如果 artifact / fixture 与当前 playbook drift，先走 replay contract triage，而不是直接 replay。

Stop condition：

- provenance chain 断裂；
- replay 依赖手工编辑后的 fixture；
- replay 需要把 redacted marker 替换成真实内容；
- fixture catalog 没有覆盖该 input 的 contract boundary。

## 12. Verification Gates

修改 real replay 边界文档时，至少运行：

```bash
git diff --check
npm run trace:fixtures --silent
npm run trace:fixtures:summary --silent
```

进入 replay contract types 或 prototype 前，还应运行：

```bash
npm run test:controlled-runtime
```

这些 gate 证明：

- committed governed fixture catalog 仍然与当前 playbook contract 兼容；
- replay gate 仍保持 no-side-effect guarantees；
- controlled runtime 现有行为未被破坏。

这些 gate 不证明：

- LLM output 语义正确；
- tool behavior 未变化；
- production store 可以被 replay；
- replay 可以写业务资产；
- real replay 可以上线。

## 13. Contract Types Status

已完成：

- `src/lib/executor/runtime/replay-sandbox-contracts.ts`
- `validateReplaySandboxContract()`
- `buildNoSideEffectReplayResultArtifact()`
- `src/__tests__/lib/executor/runtime/replay-sandbox-contracts.test.ts`

这些 TypeScript-only contracts 已覆盖：

- replay input；
- sandbox context；
- credential policy；
- approval simulation；
- store isolation；
- side-effect policy；
- replay result artifact。

它们仍然禁止：

- LLM replay；
- tool execution；
- API route calls；
- runtime store reads / writes；
- business asset writes。

## 14. Next Phase

Prototype design and implementation 已完成：

- [No-Side-Effect Replay Sandbox Prototype Design](NO_SIDE_EFFECT_REPLAY_SANDBOX_PROTOTYPE_DESIGN.zh-CN.md)
- `src/lib/executor/runtime/replay-sandbox.ts`

Catalog-level replay sandbox report 也已完成：

- `src/__tests__/fixtures/controlled-traces/replay-sandbox-report.ts`

Replay sandbox catalog CI summary 也已完成：

- `npm run replay:sandbox:fixtures`

Replay sandbox failure diagnostics hardening 也已完成：

- failed report items now classify `contract_build_failed`, `sandbox_artifact_failed`, and `guarantee_violation`.
- compact failed JSON includes `failureKind` and `guaranteeErrors`.

Replay sandbox failure harness expansion 也已完成：

- direct harness modes now cover contract, sandbox, and guarantee failures.
- supported modes emit parseable failed compact JSON and exit non-zero.

下一阶段允许进入：

**Governed Fixture And Playbook Expansion Review**

该阶段只能审查 governed fixture / playbook expansion 方向，用于决定是否新增 fixture coverage、迁移新 controlled playbook，或先强化 operational maintenance。仍不能进入真实 replay。

该阶段仍不能实现真实工具 replay，不能调用 route，不能读写 runtime store，不能写业务资产，不能恢复 raw governed artifact payload。

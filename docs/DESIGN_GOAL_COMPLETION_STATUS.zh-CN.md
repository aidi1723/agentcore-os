# AgentCore OS 设计目标完成状态

Last updated: 2026-07-07

## 当前结论

AgentCore OS 当前已经完成从“AI OS 壳”到 **Controlled Skill / Playbook Runtime** 的核心转向，但还没有完全达到最初“固定 agent 执行步骤、让结果可控、不发散”的全部设计目标。

当前状态应表述为：

- **核心控制 runtime 已建立**：固定 playbook、受限工具、人工审批、durable trace、resume / retry、approved writeback、Runtime Console、governed fixture replay、local delivery / release handoff gates 已经具备。
- **设计目标尚未完全闭环**：playbook authoring/versioning/deprecation 已有本地 proposal gate、migration plan gate 和 handoff checklist，但还没有产品化 authoring UI、真实迁移器或发布审批；统一 policy/guardrail、完整 replay gate、真实外部 connector 写回和生产级运维仍需继续硬化。
- **当前优先级不是继续做壳，也不是改做普通 skill**：下一阶段要补齐控制链路、稳定性、效率、精准性和维护路径。

## 已完成的设计目标

| 目标 | 当前状态 |
| --- | --- |
| 固定流程步骤 | 已有 `sales-pipeline-v1` 和 `support-resolution-v1` 两条 registered controlled playbook。 |
| 受限工具边界 | 每个 step 声明 `allowedTools` / `toolCalls`，validator 会拒绝越界工具。 |
| 人工审批节点 | `review` / `manual` step 必须 `requiresApproval`，Runtime Console 支持 approve / reject / resume。 |
| durable trace | controlled run、step、approval、writeback、audit event 已可查询和导出 governed trace artifact。 |
| 恢复与重试 | 支持断流 resume、审批恢复、失败 step retry eligibility 和 retry route。 |
| approved writeback | sales/support/knowledge/workflow/draft 等 server-backed writeback 已接入受控链路。 |
| fixture replay | committed governed fixtures 覆盖当前 registered playbooks，并有 no-side-effect replay gates。 |
| 本地交付证据 | delivery ready、release handoff、evidence snapshot/status/audit 等本地门禁已具备。 |
| Playbook lifecycle 第一层合同 | registered playbooks 已声明 lifecycle metadata，`playbook:control:audit` 会 fail closed 检查缺失或非法生命周期字段。 |
| Playbook lifecycle review 诊断 | `npm run playbook:lifecycle:review` 会检查 active playbook 是否达到复审日期，并在 due / overdue 时 fail closed。 |
| Deprecated replacement 合同 | deprecated playbook 必须声明 `deprecatedAt`、`deprecationReason` 和已注册 `replacementPlaybookId`，否则 `playbook:control:audit` fail closed。 |
| Playbook lifecycle handoff checklist | `npm run playbook:lifecycle:handoff` 会聚合 control audit 与 lifecycle review，汇总 lifecycle status counts 和 deprecated replacement chains，作为 version/deprecation handoff 前的本地只读门禁。 |
| Playbook lifecycle change proposal gate | `npm run playbook:lifecycle:change:check -- --proposal <path>` 会检查结构化变更提案的 spec/plan、必需命令、fixture expectation 和 deprecation metadata。 |
| Playbook lifecycle migration plan gate | `npm run playbook:lifecycle:migration:plan:check -- --plan <path>` 会检查迁移计划的 proposal linkage、planned changes、rollback、fixture review、必需命令和 no-mutation policy。 |
| Playbook lifecycle maintenance sequence gate | `npm run playbook:lifecycle:sequence:check -- --sequence <path>` 会检查 proposal check、migration plan check、lifecycle handoff、fixture gate 和 controlled runtime test 是否按顺序声明，并保持 no-mutation / no-publish policy。 |
| Playbook lifecycle sequence evidence gate | `npm run playbook:lifecycle:sequence:evidence:check -- --evidence <path>` 会检查已记录 evidence 是否覆盖 sequence 声明的命令顺序、green 状态、handoff/fixture/runtime 证据和 no-mutation / no-publish summaries。 |

## 尚未完全达成的目标

| 缺口 | 影响 | 下一步处理 |
| --- | --- | --- |
| 控制链路审计还需进入维护工作流 | `npm run playbook:control:audit`、`npm run playbook:lifecycle:change:check`、`npm run playbook:lifecycle:migration:plan:check`、`npm run playbook:lifecycle:sequence:check`、`npm run playbook:lifecycle:sequence:evidence:check` 和 `npm run playbook:lifecycle:handoff` 已能覆盖 proposal intake、migration planning、ordered maintenance declaration、recorded evidence contract、playbook 合同、工具、审批、写回、lifecycle、guardrails、fixture coverage 与复审状态，但还没有形成 authoring/versioning/deprecation 的完整产品化维护流。 | 下一阶段把 proposal gate、migration plan gate、sequence gate、evidence gate 和 handoff checklist 作为 playbook 维护和版本变更的默认入口，再扩展真实迁移执行边界。 |
| playbook 声明与写回落点可能漂移 | 执行能跑，但 `resultAssets` 等声明可能没有覆盖真实 writeback targets，影响精准性和维护判断。 | 已审计写回目标与 resultAssets 对齐，失败时 fail closed。 |
| playbook lifecycle 仍未产品化 | 当前已有 status/owner/review/changePolicy、本地复审诊断、deprecated replacement 合同、proposal gate、migration plan gate、sequence gate、sequence evidence gate 和 handoff checklist，但还没有完整 authoring UI、版本迁移器和 deprecation flow。 | 下一阶段扩展 authoring/versioning/deprecation workflow。 |
| policy / guardrail 分散 | 工具策略、失败策略、审批策略存在，但还未形成统一 policy layer。 | 下一阶段把审计结果作为 policy hardening 输入。 |
| replay 仍是 metadata-only | 当前 fixture replay 不执行真实工具、不调用 API、不写 store，适合合同回归，不等于真实 replay。 | 继续推进 no-side-effect sandbox 到更完整的 per-playbook replay gate。 |
| UI 仍是操作面，不是完整 authoring console | Runtime Console 可查看、审批、恢复、打开资产，但 playbook authoring/lifecycle 尚未产品化。 | 后续先做 operator diagnostics，再评估 authoring UI。 |
| 外部 connector / 生产写回仍受限 | 当前是本地优先和 demo-grade delivery boundary。 | 保持 no-publication boundary，逐步增加 connector proof。 |

## 下一阶段目标

下一阶段继续进入 **Control Chain Hardening**，重点从审计门扩展到 playbook authoring/versioning/deprecation 维护流。

目标不是新增 playbook，而是让现有 playbook 的执行合同更稳定：

1. 控制链路：每条 registered playbook 必须通过统一审计，覆盖 step order、schema、tool boundary、approval gate、failure policy、writeback boundary、fixture coverage。
2. 稳定：审计命令进入 `test:controlled-runtime`，让合同漂移在本地回归中暴露。
3. 效率：提供一条快速本地命令给维护者定位 playbook 问题，避免从多个文档和测试里人工拼判断。
4. 精准：审计报告必须指出具体 playbook、step、target 和修复方向。
5. 下一阶段准备：审计与 handoff 报告输出 machine-readable JSON，后续可被 release gate、Runtime Console diagnostics 或 CI 使用。

## 边界

本阶段不做：

- 新增业务 playbook；
- 新增外部 connector 写操作；
- 改 UI；
- 创建 release tag；
- 发布 GitHub Release；
- 上传 artifact；
- 宣称 production ready。

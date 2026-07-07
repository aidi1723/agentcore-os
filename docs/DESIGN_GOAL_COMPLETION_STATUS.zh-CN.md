# AgentCore OS 设计目标完成状态

Last updated: 2026-07-07

## 当前结论

AgentCore OS 当前已经完成从“AI OS 壳”到 **Controlled Skill / Playbook Runtime** 的核心转向，但还没有完全达到最初“固定 agent 执行步骤、让结果可控、不发散”的全部设计目标。

当前状态应表述为：

- **核心控制 runtime 已建立**：固定 playbook、受限工具、人工审批、durable trace、resume / retry、approved writeback、Runtime Console、governed fixture replay、local delivery / release handoff gates 已经具备。
- **设计目标尚未完全闭环**：playbook authoring/lifecycle、统一 policy/guardrail、完整 replay gate、真实外部 connector 写回、生产级运维和 per-playbook 控制链路审计仍需继续硬化。
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

## 尚未完全达成的目标

| 缺口 | 影响 | 下一步处理 |
| --- | --- | --- |
| 控制链路缺少统一 playbook 审计门 | 单个 validator / fixture replay 已存在，但原先没有一条命令汇总检查 playbook 合同、工具、审批、写回、guardrails、fixture coverage。 | 已新增并继续强化 `npm run playbook:control:audit`。 |
| playbook 声明与写回落点可能漂移 | 执行能跑，但 `resultAssets` 等声明可能没有覆盖真实 writeback targets，影响精准性和维护判断。 | 审计写回目标与 resultAssets 对齐，失败时 fail closed。 |
| policy / guardrail 分散 | 工具策略、失败策略、审批策略存在，但还未形成统一 policy layer。 | 下一阶段把审计结果作为 policy hardening 输入。 |
| replay 仍是 metadata-only | 当前 fixture replay 不执行真实工具、不调用 API、不写 store，适合合同回归，不等于真实 replay。 | 继续推进 no-side-effect sandbox 到更完整的 per-playbook replay gate。 |
| UI 仍是操作面，不是完整 authoring console | Runtime Console 可查看、审批、恢复、打开资产，但 playbook authoring/lifecycle 尚未产品化。 | 后续先做 operator diagnostics，再评估 authoring UI。 |
| 外部 connector / 生产写回仍受限 | 当前是本地优先和 demo-grade delivery boundary。 | 保持 no-publication boundary，逐步增加 connector proof。 |

## 下一阶段目标

下一阶段默认进入 **Playbook Control Audit / Control Chain Hardening**。

目标不是新增 playbook，而是让现有 playbook 的执行合同更稳定：

1. 控制链路：每条 registered playbook 必须通过统一审计，覆盖 step order、schema、tool boundary、approval gate、failure policy、writeback boundary、fixture coverage。
2. 稳定：审计命令进入 `test:controlled-runtime`，让合同漂移在本地回归中暴露。
3. 效率：提供一条快速本地命令给维护者定位 playbook 问题，避免从多个文档和测试里人工拼判断。
4. 精准：审计报告必须指出具体 playbook、step、target 和修复方向。
5. 下一阶段准备：审计报告输出 machine-readable JSON，后续可被 release gate、Runtime Console diagnostics 或 CI 使用。

## 边界

本阶段不做：

- 新增业务 playbook；
- 新增外部 connector 写操作；
- 改 UI；
- 创建 release tag；
- 发布 GitHub Release；
- 上传 artifact；
- 宣称 production ready。

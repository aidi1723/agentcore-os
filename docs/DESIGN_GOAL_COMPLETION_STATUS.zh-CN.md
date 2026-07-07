# AgentCore OS 设计目标完成状态

Last updated: 2026-07-07

## 当前结论

AgentCore OS 当前已经完成从“AI OS 壳”到 **Controlled Skill / Playbook Runtime** 的核心转向，但还没有完全达到最初“固定 agent 执行步骤、让结果可控、不发散”的全部设计目标。

当前状态应表述为：

- **核心控制 runtime 已建立**：固定 playbook、受限工具、人工审批、durable trace、resume / retry、approved writeback、Runtime Console、governed fixture replay、local delivery / release handoff gates 已经具备。
- **当前 controlled-runtime 里程碑可以进入 local delivery candidate、production release policy review、production release approval、release execution planning、package build gate review、tag creation gate review、artifact upload gate review 和 deployment gate review 状态，但完整设计目标尚未生产化闭环**：playbook authoring/versioning/deprecation 已有 proposal、migration plan、maintenance sequence、sequence evidence、freshness/doctor、maintenance readiness、mutation approval、mutation dry-run、handoff、project closeout gate、mutation preflight、本地 manifest-based mutation executor 边界、post-apply sequence gate、post-apply evidence gate、fixture refresh handoff gate、candidate fixture review gate、fixture replacement handoff gate、post-replacement evidence gate、release handoff review gate、handoff summary gate、delivery candidate gate、production release policy gate、production release approval packet gate、release execution planning gate、package build execution gate、tag creation execution gate、artifact upload execution gate 和 deployment execution gate；但还没有产品化 authoring UI、实际 external-write execution gate；统一 policy/guardrail、完整 replay gate、真实外部 connector 写回和生产级运维仍需继续硬化。
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
| Playbook lifecycle sequence evidence freshness gate | `npm run playbook:lifecycle:sequence:evidence:freshness:check -- --evidence <path>` 会检查已记录 evidence 的 source commit、sequence digest 和 max-age freshness，避免 stale evidence 被用于维护判断。 |
| Playbook lifecycle sequence evidence doctor | `npm run playbook:lifecycle:sequence:evidence:doctor -- --evidence <path>` 会把 freshness/provenance 失败归类为 missing、invalid、stale、commit mismatch、digest mismatch、future recordedAt 等维护状态，并给出下一步本地命令。 |
| Playbook lifecycle maintenance readiness gate | `npm run playbook:lifecycle:maintenance:ready -- --evidence <path>` 会聚合 lifecycle handoff 与 sequence evidence doctor，只有 catalog handoff green 且 evidence fresh 时才给出维护准入状态。 |
| Playbook lifecycle mutation approval gate | `npm run playbook:lifecycle:mutation:approval:check -- --approval <path>` 会检查 readiness green 后的结构化批准回执，并确认未执行迁移、未刷新 fixture、未写 store、未发布。 |
| Playbook lifecycle mutation dry-run gate | `npm run playbook:lifecycle:mutation:dry-run:check -- --dry-run <path>` 会检查批准后的拟变更 playbook target、fixture impact 和 dry-run-only 边界。 |
| Project closeout readiness gate | `npm run project:closeout:check -- --evidence <path> --dry-run <path>` 会聚合 control audit、maintenance readiness、mutation dry-run 和 delivery readiness，给出当前 controlled-runtime 里程碑可收尾结论，同时保持 `productionReady: false` 并列出下一阶段延期项。 |
| Playbook lifecycle mutation preflight gate | `npm run playbook:lifecycle:mutation:preflight:check -- --evidence <path> --dry-run <path>` 会在真实 mutation executor 前聚合 closeout、dry-run、approval、target scope 和 dry-run-only 边界，只允许进入人工 mutation executor 实现审查。 |
| Playbook lifecycle mutation executor boundary | `npm run playbook:lifecycle:mutation:executor:preview -- --manifest <path> --evidence <path> --dry-run <path>` 会只读校验 manifest、fresh preflight、dry-run 声明的目标 scope 和 SHA-256；`apply -- --confirm-apply` 只允许本地 registered playbook 文件替换，且保持不刷新 fixture、不写 store、不外部写入、不发布。 |
| Playbook lifecycle mutation post-apply sequence gate | `npm run playbook:lifecycle:mutation:post-apply:sequence:check -- --sequence <path>` 会检查 apply report 已完成，并要求 apply 后按 control audit、lifecycle handoff、governed fixture gate、controlled-runtime、core-workflows 和 `git diff --check` 的固定顺序进入审计；在审计证据存在前不允许刷新 fixture、发布或宣称 production ready。 |
| Playbook lifecycle mutation post-apply evidence gate | `npm run playbook:lifecycle:mutation:post-apply:evidence:check -- --evidence <path>` 会检查已记录的 post-apply command results 是否严格匹配 sequence 顺序、全部 green，并证明审计期间没有 fixture refresh、store writes、external writes、publishing 或 production-ready claim。 |
| Playbook lifecycle mutation fixture refresh handoff gate | `npm run playbook:lifecycle:mutation:fixture-refresh:handoff:check -- --handoff <path>` 会在 post-apply evidence green 后检查目标 playbook、目标 governed fixture id、人工 refresh review checklist、rollback notes 和 handoff-only 边界；它只允许进入人工 fixture refresh review，不生成候选 fixture、不替换 committed fixture、不发布、不宣称 production ready。 |
| Playbook lifecycle mutation candidate fixture review gate | `npm run playbook:lifecycle:mutation:candidate-fixture:review:check -- --review <path>` 会在 fixture refresh handoff green 后检查候选 fixture validation/replay、catalog fixture target、目标 playbook、敏感标记、人工 review evidence 和 no-replacement 边界；它只允许进入人工 committed fixture replacement review，不生成或替换 fixture、不发布、不宣称 production ready。 |
| Playbook lifecycle mutation fixture replacement handoff gate | `npm run playbook:lifecycle:mutation:fixture-replacement:handoff:check -- --handoff <path>` 会在 candidate fixture review green 后检查目标/path 对齐、committed fixture path scope、rollback evidence、post-replacement validation plan 和 handoff-only 边界；它只允许进入人工 committed fixture replacement，不替换 fixture、不发布、不宣称 production ready。 |
| Playbook lifecycle mutation post-replacement evidence gate | `npm run playbook:lifecycle:mutation:post-replacement:evidence:check -- --evidence <path>` 会在人工 committed fixture replacement 后检查 replacement summary、handoff/fixture/runtime/core/diff evidence 和 no-publish/no-production 边界；它不替换 fixture、不运行命令、不发布、不宣称 production ready。 |
| Playbook lifecycle mutation release handoff review gate | `npm run playbook:lifecycle:mutation:release-handoff:review:check -- --review <path>` 会在 post-replacement evidence green 后检查 release handoff、snapshot、status、audit 和 diff review evidence；它不运行 release 命令、不生成 snapshot、不发布、不宣称 production ready。 |
| Playbook lifecycle mutation handoff summary gate | `npm run playbook:lifecycle:mutation:handoff:summary:check -- --summary <path>` 会在 release handoff review green 后检查维护者摘要、命令摘要、risk/deferred items、rollback notes 和 no-publish/no-production 边界；它不运行命令、不生成 snapshot、不发布、不宣称 production ready。 |
| Delivery candidate gate | `npm run delivery:candidate:check -- --candidate <path>` 会在 handoff summary green 后检查 delivery readiness、controlled-runtime、core-workflows、lint、build、diff、文档对齐、risk/deferred items、rollback notes 和 no-publish/no-production 边界；它不运行完整命令、不发布、不打 tag、不打包、不上传、不宣称 production ready。 |
| Production release policy gate | `npm run release:production-policy:check -- --policy <path>` 会在 delivery candidate green 后检查生产发布策略包、ordered command evidence、packaging/tag/upload/deployment/external writes/monitoring/rollback 策略、risk posture 和 policy-only 边界；它不运行命令、不发布、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。 |
| Production release approval packet gate | `npm run release:production-approval:check -- --approval <path>` 会在 production release policy green 后检查 reviewer、approval scope、expiry、rollback owner、monitoring owner、release action decisions、risk acceptance 和 approval-only 边界；它不运行命令、不发布、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。 |
| Release execution planning gate | `npm run release:execution-plan:check -- --plan <path>` 会在 production release approval green 后检查 packaging、tag creation、artifact upload、deployment、external writes 的 planned actions、ordered command evidence、preconditions、rollback、monitoring、credential boundary 和 planning-only 边界；它不运行命令、不发布、不打 tag、不打包、不上传、不部署、不使用凭证、不宣称 production ready。 |
| Package build execution gate | `npm run release:package-build:gate:check -- --gate <path>` 会在 release execution plan green 后检查 package build request、source/supply-chain review、command evidence、rollback、monitoring、artifact handling、credential boundary 和 gate-only 边界；它不运行 `desktop:package`、不创建 artifact、不发布、不打 tag、不上传、不部署、不使用凭证、不宣称 production ready。 |
| Tag creation execution gate | `npm run release:tag-creation:gate:check -- --gate <path>` 会在 package build gate green 后检查 tag request、tag policy review、source commit evidence、release-note linkage、command evidence、rollback、monitoring、credential boundary 和 gate-only 边界；它不运行 `git tag`、不 push tag、不创建 release、不上传、不部署、不使用凭证、不宣称 production ready。 |
| Artifact upload execution gate | `npm run release:artifact-upload:gate:check -- --gate <path>` 会在 tag creation gate green 后检查 artifact upload request、artifact identity review、checksum/provenance policy、upload destination policy、command evidence、rollback、monitoring、credential boundary 和 gate-only 边界；它不创建 artifact、不计算 checksum、不上传、不创建 release、不部署、不写 store、不使用凭证、不宣称 production ready。 |
| Deployment execution gate | `npm run release:deployment:gate:check -- --gate <path>` 会在 artifact upload gate green 后检查 deployment request、environment review、pre-deployment checks、command evidence、rollback、monitoring、credential boundary 和 gate-only 边界；它不部署、不外部写入、不写 store、不使用凭证、不宣称 production ready。 |

## 尚未完全达成的目标

| 缺口 | 影响 | 下一步处理 |
| --- | --- | --- |
| 控制链路已具备本地交付候选、生产发布策略、发布批准包、执行计划、package build gate、tag creation gate、artifact upload gate 和 deployment gate | `npm run delivery:candidate:check` 已把 handoff summary、delivery readiness、controlled-runtime、core-workflows、lint、build、diff 与文档对齐聚合为本地只读交付候选信号；`npm run release:production-policy:check` 已把候选结果、命令证据、发布策略和 rollback 边界聚合成只读 policy review 信号；`npm run release:production-approval:check` 已把 reviewer、scope、expiry、owner 和 release action decisions 聚合成只读 approval packet；`npm run release:execution-plan:check` 已把 packaging/tag/upload/deploy/external-write 的计划、rollback、monitoring 和 credential boundary 聚合成只读 planning 信号；`npm run release:package-build:gate:check` 已把 package build request、source review、artifact handling 和 gate-only boundary 聚合成只读 package build review 信号；`npm run release:tag-creation:gate:check` 已把 tag request、tag policy、source commit、release-note linkage 和 no-tag-created boundary 聚合成只读 tag creation review 信号；`npm run release:artifact-upload:gate:check` 已把 artifact upload request、identity、checksum/provenance、upload destination、rollback/monitoring 和 no-upload boundary 聚合成只读 artifact upload review 信号；`npm run release:deployment:gate:check` 已把 deployment request、environment review、pre-deployment checks、rollback/monitoring 和 no-deploy boundary 聚合成只读 deployment review 信号。 | 当前可描述为 local delivery candidate with production release policy、approval packet、execution plan、package build gate、tag creation gate、artifact upload gate and deployment gate defined；下一阶段从 external-write execution gate、authoring UI、统一 policy、真实 replay、connector 写回和生产运维准备开始。 |
| mutation executor 已有本地写入边界，但未生产化 | `npm run playbook:lifecycle:mutation:executor:preview` / `apply` 已支持 manifest、fresh preflight、dry-run 目标对齐、当前 hash、next content hash 和显式确认；apply 仅替换本地 registered playbook 文件，且已有 post-apply sequence / evidence / fixture refresh handoff / candidate fixture review / fixture replacement handoff / post-replacement evidence / release handoff review / handoff summary / delivery candidate gate 约束后续审计顺序、记录与人工 review 交接。 | 下一阶段补齐产品化 authoring/versioning 流程、统一 policy 和生产发布策略。 |
| playbook 声明与写回落点可能漂移 | 执行能跑，但 `resultAssets` 等声明可能没有覆盖真实 writeback targets，影响精准性和维护判断。 | 已审计写回目标与 resultAssets 对齐，失败时 fail closed。 |
| playbook lifecycle 仍未产品化 | 当前已有 status/owner/review/changePolicy、本地复审诊断、deprecated replacement 合同、proposal gate、migration plan gate、sequence gate、sequence evidence/freshness gate 和 handoff checklist，但还没有完整 authoring UI、版本迁移器和 deprecation flow。 | 下一阶段扩展 authoring/versioning/deprecation workflow。 |
| policy / guardrail 分散 | 工具策略、失败策略、审批策略存在，但还未形成统一 policy layer。 | 下一阶段把审计结果作为 policy hardening 输入。 |
| replay 仍是 metadata-only | 当前 fixture replay 不执行真实工具、不调用 API、不写 store，适合合同回归，不等于真实 replay。 | 继续推进 no-side-effect sandbox 到更完整的 per-playbook replay gate。 |
| UI 仍是操作面，不是完整 authoring console | Runtime Console 可查看、审批、恢复、打开资产，但 playbook authoring/lifecycle 尚未产品化。 | 后续先做 operator diagnostics，再评估 authoring UI。 |
| 外部 connector / 生产写回仍受限 | 当前是本地优先和 demo-grade delivery boundary。 | 保持 no-publication boundary，逐步增加 connector proof。 |

## 下一阶段目标

下一阶段继续 **External-Write Execution Gate Design**，重点从 deployment gate 扩展到 external writes 的独立 execution gate 设计，继续保持非执行边界。

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

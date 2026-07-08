# Production Release Completion Evidence Boundary

Last updated: 2026-07-08

## 目标

这个文档说明 `production release completion evidence boundary` 的维护方式。

它解决的问题是：

**当人类/operator 已经在 checker 外部完成真实发布动作后，项目如何用本地、结构化、可审计的方式验证这份完成证据。**

它不解决、也不授权的问题是：

- 不打包；
- 不创建 tag；
- 不 push tag；
- 不上传 artifact；
- 不创建 GitHub Release；
- 不部署；
- 不调用 connector；
- 不执行外部写入；
- 不写 runtime store 或业务资产；
- 不运行生产验证；
- 不读取或使用生产凭证；
- 不基于仓库内示例宣称 production ready。

## 命令

当前命令：

```bash
npm run release:completion:evidence:check -- --evidence <path>
```

仓库内 schema-only 示例：

```bash
npm run release:completion:evidence:check -- --evidence docs/release-completion-evidence/example-production-release-completion-evidence.json --compact
```

这个示例只用于验证 evidence packet 的结构和边界。它不是实际发布完成证据。

## 证据模式

`evidenceMode` 当前只允许两种。

### `example_schema_only`

用于仓库内示例、文档、测试和维护者理解 schema。

必须保持：

- `schemaExampleOnly: true`
- `productionReleaseCompleted: false`
- `productionReady: false`
- `publishingPerformed: false`
- 所有 release action `performed: false`

该模式下，checker 通过只代表“schema 和边界有效”，不代表真实生产发布完成。

### `operator_recorded_actual_execution`

用于真实人类/operator 在 checker 外部执行发布动作后的记录。

只有以下证据全部 green 时，checker 才能验证为 operator evidence 支撑的生产发布完成：

- 上游 `release:execution-approval:check` 结果 green；
- package build evidence；
- tag creation evidence；
- artifact upload evidence；
- deployment evidence；
- external writes evidence；
- production verification evidence；
- credential use evidence；
- monitoring evidence；
- rollback evidence；
- audit trail；
- checker no-side-effect boundary。

该模式可以输出：

- `productionReleaseCompleted: true`
- `productionReady: true`
- `publishingPerformed: true`
- `releaseCompletionClaim: "production_release_completed_by_operator_evidence"`

这仍然表示“checker 验证了 operator 记录的事实”，不是 checker 自己执行了发布动作。

## 上游边界

completion evidence 必须引用并复用 release execution approval boundary：

```bash
npm run release:execution-approval:check -- --approval <path>
```

上游 approval boundary 必须保持：

- `ok: true`
- `approvalBoundaryOnly: true`
- `productionReady: false`
- `publishingPerformed: false`

如果上游 approval evidence 不 green，completion evidence 必须 fail closed。

## Checker 验证什么

checker 会验证：

- evidence identity、owner、recordedAt、targetVersion 和 scope；
- `evidenceMode` 是否受支持；
- schema-only 示例是否没有越界声明真实发布完成；
- actual operator evidence 是否包含完整 release action evidence；
- release action evidence 是否 `performed: true`、`ok: true` 且记录了执行人、执行时间、命令或流程、证据引用、rollback 和 monitoring linkage；
- credential evidence 是否记录了 approver、scope、redaction policy 和 no-secret-storage 边界；
- post-execution verification 是否明确通过；
- monitoring evidence 是否有 owner、窗口和链接；
- rollback evidence 是否可用；
- audit trail 是否覆盖关键动作；
- checker 是否声明自己没有执行 release action、没有使用凭证、没有外部写入。

## 当前项目状态

当前仓库已经具备：

- release execution approval boundary；
- production release completion evidence checker；
- schema-only 示例 evidence packet；
- helper 和 CLI 测试覆盖；
- `test:controlled-runtime` 覆盖；
- 文档与 changelog 对齐。

当前仓库尚不具备：

- operator-recorded actual execution evidence；
- release closeout report；
- production operations runbook；
- incident / rollback execution evidence；
- long-running monitoring observation evidence；
- final production closeout decision。

因此当前状态应表述为：

**local delivery candidate with full release-control and completion-evidence schema boundary defined, not production ready.**

## 维护路径

后续如要推进真实发布闭环，顺序应为：

1. 先保持 `release:completion:evidence:check` 的 schema-only 示例 green。
2. 由明确的人类/operator 在 checker 外部执行被批准的 release actions。
3. 记录 `operator_recorded_actual_execution` evidence packet。
4. 用本 checker 验证该 evidence packet。
5. 再进入 release closeout / operations evidence hardening。

下一阶段默认方向：

- release closeout report；
- operations runbook；
- incident / rollback evidence；
- monitoring observation window evidence；
- final closeout decision gate。

这些仍然必须保持 checker 非执行边界：checker 只能验证证据，不能替 operator 执行生产动作。

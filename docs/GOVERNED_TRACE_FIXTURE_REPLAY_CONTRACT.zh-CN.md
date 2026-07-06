# Governed Trace Fixture Replay Contract

Last updated: 2026-07-06

## 1. Purpose

本文档解释 `npm run trace:fixtures --silent` 如何校验 committed governed trace fixture，以及当 replay 失败时维护者应该如何判断原因。

它是 `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md` 的配套文档。Refresh guide 说明如何生成和替换 fixture；本文档说明 replay gate 为什么失败，以及失败后应该先改 playbook、刷新 fixture，还是拒绝 artifact source。

## 2. Hard Boundaries

Fixture replay 是纯 metadata 校验：

- no LLM replay;
- no tool execution or simulation;
- no API route calls;
- no runtime store reads or writes;
- no asset writes;
- no automatic fixture discovery;
- no automatic committed fixture refresh.

Replay green 只说明 committed fixture metadata 与当前 controlled playbook contract 兼容，不说明原始业务输出语义仍然正确。

## 3. Source Of Truth

Replay 使用以下来源，顺序固定：

1. `validateControlledTraceFixture()` checks fixture schema, redaction, and fixture self-consistency.
2. `getControlledPlaybook()` provides the current playbook source of truth.
3. `replayControlledTraceFixture()` compares committed fixture metadata to the current playbook.
4. `buildControlledTraceFixtureCatalogReport()` aggregates validation and replay results for the explicit catalog.
5. `scripts/trace-fixtures/catalog-report.mjs` prints the machine-readable local summary.

换句话说，fixture 不是新的 contract source。当前 playbook catalog 才是 step order、approval、plan metadata、writeback target 的来源。

## 4. Replay Invariant Matrix

| Area | Checked fields | Source of truth | Failure means | Maintainer action |
| --- | --- | --- | --- | --- |
| Fixture schema and identity | `schemaVersion`, `sourceRunId`, `playbookId`, `assertions.stepOrder` | `validateControlledTraceFixture()` | Fixture 形状或自声明 step order 不可信 | 不要替换 fixture；重新生成 candidate 或修复 artifact source |
| Redaction boundary | `hasRedactedInput`, `hasRedactedOutput`, `toolCalls[].outputRedacted` | Governed artifact redaction contract | Candidate fixture 暴露了不应提交的 raw payload 风险 | 拒绝 candidate；回到 governed artifact source |
| Registered playbook | `playbookId` | `getControlledPlaybook()` | Fixture 指向的 playbook 不存在或已被移除 | 先确认 playbook 是否应恢复；不要盲目刷新 fixture |
| Playbook version and scenario | `playbookVersion`, `scenarioId` | current `ControlledPlaybook.version` / `scenarioId` | 当前 playbook 与 fixture 记录的版本或场景漂移 | 如果 playbook 变更是正确的，重新生成 fixture；否则修正 playbook metadata |
| Step order | `steps[].stepId`, `assertions.stepOrder` | current `playbook.steps[].id` | Playbook 步骤顺序或 fixture 顺序过期 | 确认 playbook 新顺序后刷新 fixture |
| Plan metadata | `plan.id`, `plan.totalSteps`, `plan.requiresApproval`, `plan.stepOrder` | current playbook id/version/steps/approval gates | Fixture plan snapshot 与当前 playbook 不一致 | 如果当前 playbook 正确，重新生成 fixture |
| Approval state presence | approval-gated step `approvalState` | `playbook.steps[].requiresApproval` | Fixture 未记录当前 approval gate 所需审批状态 | 刷新 fixture 或检查 artifact 是否丢失 approval metadata |
| Approval terminal state | completed approval-gated step `approvalState === "approved"` | controlled replay terminal-state invariant | Completed fixture 声称完成，但审批不是 approved | 拒绝 candidate；检查源 run 是否真的完成 |
| Required writeback targets | step `writebackTargets[].target` | `playbook.steps[].writesTo[].target` | 当前 playbook 要写回的 target 在同一步 fixture 中缺失 | 确认 playbook writeback 变更后刷新 fixture |
| Stable writeback metadata | successful target `assetId`, `sourceKey`, `workflowRunId` | Runtime Console deep link / record focus contract | 成功 receipt 不能稳定定位写回资产 | 拒绝 candidate 或修复 writeback receipt source |
| Completed attempts | completed step `attempts >= 1` | controlled step execution trace metadata | Fixture 记录为 completed 但没有执行尝试 | 检查 artifact source；不要提交不完整 trace |
| No-side-effect guarantees | `toolCallsExecuted: false`, `assetsWritten: false` | replay report constants | Replay runner purity 被破坏 | 停止并审查 replay implementation |

## 5. Diagnostics Reference

| Diagnostic field | Meaning | First action |
| --- | --- | --- |
| `fixtureId` | 当前 replay 的 fixture id | 确认失败项对应预期 fixture |
| `playbookId` | Fixture 声明的 playbook id | 对照 catalog entry 和 intended playbook |
| `expectedPlaybookVersion` | 当前注册 playbook version | 与 `fixturePlaybookVersion` 比较 |
| `fixturePlaybookVersion` | Fixture 记录的 playbook version | 如果过期，重新生成 fixture |
| `expectedScenarioId` | 当前注册 playbook scenario id | 与 `fixtureScenarioId` 比较 |
| `fixtureScenarioId` | Fixture 记录的 scenario id | 如果漂移，确认 playbook 迁移是否正确 |
| `expectedPlanId` | `playbook:{playbookId}:{version}` | 与 `fixturePlanId` 比较 |
| `fixturePlanId` | Fixture 记录的 plan id | 如果过期，重新生成 fixture |
| `expectedPlanTotalSteps` | 当前 playbook step count | 与 `fixturePlanTotalSteps` 比较 |
| `fixturePlanTotalSteps` | Fixture 记录的 plan step count | 如果过期，重新生成 fixture |
| `expectedPlanRequiresApproval` | 当前 playbook 是否含 approval gate | 与 `fixturePlanRequiresApproval` 比较 |
| `fixturePlanRequiresApproval` | Fixture plan snapshot 中的 approval flag | 如果漂移，确认 approval gate 变更 |
| `planStepOrder` | Fixture plan snapshot 的 step order | 对照 `expectedStepOrder` 和 `fixtureStepOrder` |
| `expectedStepOrder` | 当前 playbook step order | 判断 playbook contract 是否变更 |
| `fixtureStepOrder` | Fixture 实际 steps order | 判断 fixture 是否 stale |
| `missingApprovalStepIds` | 当前 approval-gated steps 中 fixture 缺少 approval state 的 step ids | 检查 artifact approval metadata |
| `missingWritebackTargets` | 当前 playbook 要求但 fixture 缺失的 writeback targets | 检查 writeback contract 或刷新 fixture |
| `missingCompletedStepAttempts` | Completed fixture step 中 `attempts < 1` 的 step ids | 拒绝不完整 artifact source |
| `nonApprovedApprovalStepIds` | Completed approval-gated step 不是 `approved` 的 step ids | 拒绝不一致 candidate 或检查源 run terminal state |
| `writebackTargetsMissingStableMetadata` | Successful writeback receipt 缺少 `assetId` / `sourceKey` / `workflowRunId` 的 target 列表 | 修复 receipt source 或重新生成 fixture |

## 6. Failure Triage

### Playbook Drift

Signs:

- `expectedStepOrder` differs from `fixtureStepOrder`;
- `expectedPlaybookVersion` differs from `fixturePlaybookVersion`;
- `expectedPlanId`, `expectedPlanTotalSteps`, or `expectedPlanRequiresApproval` differs from fixture-side values;
- `missingWritebackTargets` is non-empty after an intentional playbook writeback change.

Action:

1. Confirm the current playbook change is intentional.
2. Update or add playbook tests if the new contract is intended.
3. Generate a candidate fixture from a fresh governed trace artifact.
4. Replace the committed fixture only after manual review.

### Stale Fixture

Signs:

- Current playbook is correct.
- Fixture still references old version, plan id, step order, approval flag, or writeback target list.
- Redaction remains valid.

Action:

1. Follow `docs/GOVERNED_TRACE_FIXTURE_REFRESH.zh-CN.md`.
2. Build candidate fixture with `npm run trace:fixture:build`.
3. Review candidate metadata against this contract matrix.
4. Run `npm run trace:fixtures --silent` and `npm run test:controlled-runtime`.

### Bad Governed Artifact Source

Signs:

- Missing redaction flags.
- Completed step has `attempts < 1`.
- Completed approval-gated step has `approvalState` other than `approved`.
- Successful writeback receipt lacks stable identity metadata.

Action:

1. Do not commit the generated fixture.
2. Inspect the governed trace artifact source.
3. Re-export from a known-good completed controlled run.
4. If the source route produced unsafe metadata, fix the artifact builder before refreshing fixtures.

### Unsafe Candidate Fixture

Signs:

- Candidate JSON contains raw customer names, emails, secrets, prompt text, tool output, or unredacted payload markers.
- `validateControlledTraceFixture()` emits redaction errors.
- The candidate passes shape checks but fails stable writeback metadata needed for Runtime Console deep links.

Action:

1. Reject the candidate.
2. Do not edit raw payloads out by hand.
3. Fix the governed artifact redaction/writeback source and regenerate.

## 7. Maintainer Command Sequence

Check current committed fixture catalog:

```bash
npm run trace:fixtures --silent
```

When it fails, inspect:

- `failedItems[].validationErrors`;
- `failedItems[].replayErrors`;
- `failedItems[].diagnostics`.

Build a candidate fixture only after confirming the current playbook contract is correct:

```bash
npm run trace:fixture:build -- /tmp/governed-trace-artifact.json > /tmp/governed-trace-fixture.json
```

After manual replacement, run:

```bash
npm run trace:fixtures --silent
npm run test:controlled-runtime
```

For normal committed changes, also run:

```bash
npm run test:core-workflows
npm run lint
npm run build
git diff --check
```

## 8. What This Does Not Prove

Green replay does not prove:

- original LLM output was semantically correct;
- tool behavior has not changed;
- runtime stores contain the same records;
- asset contents are still business-valid;
- the controlled run should be replayed in production.

Green replay proves only that committed governed fixture metadata still matches the current controlled playbook contract and preserves the no-side-effect replay boundary.

# Controlled AI Execution Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a technically accurate Chinese Markdown article explaining how AgentCore OS constrains AI hallucination at the business-execution boundary and how it differs from Skills, AI shells, and n8n.

**Architecture:** Create one self-contained public article in the documentation root. Build the narrative from a concrete failure example into the controlled-runtime architecture, comparisons, current implementation evidence, limitations, and reusable publication metadata. Verify every maturity claim against the project framework and current runtime source before declaring the article ready.

**Tech Stack:** Markdown, repository-relative documentation links, `rg`, Git whitespace validation

---

### Task 1: Write the publishable article

**Files:**
- Create: `docs/controlled-ai-execution-runtime.zh-CN.md`
- Reference: `docs/superpowers/specs/2026-07-12-controlled-ai-execution-blog-design.md`
- Reference: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Reference: `src/lib/executor/playbooks/types.ts`
- Reference: `src/lib/executor/playbooks/validator.ts`

- [ ] **Step 1: Create the article with publication metadata**

Start the file with the approved title, a concise abstract, and a note that the article reflects the repository state on 2026-07-12. Do not add framework-specific frontmatter so the same Markdown remains portable across the website, CSDN, and GitHub.

- [ ] **Step 2: Write the problem and thesis sections**

Open with a structurally valid but factually unsupported sales-priority example. Establish this thesis verbatim:

> 模型输出不必绝对可靠，但系统必须保证不可靠的输出无法未经验证就成为真实业务事实。

Explain that the runtime controls the propagation and consequences of hallucination rather than claiming to eliminate model error.

- [ ] **Step 3: Write the runtime architecture section**

Include this execution flow:

```text
User / Trigger
  -> Playbook Resolver
  -> Plan Validator
  -> Runtime State Machine
  -> Step Runner
  -> Tool Gateway
  -> Approval Gate
  -> Trace Store
  -> Asset Writeback
  -> Runtime Console
```

Explain the responsibilities of each layer and link the claims to repository-relative source files.

- [ ] **Step 4: Explain the three meanings of controllability**

Separate and define:

1. 流程可控：步骤、顺序、工具和失败策略受约束。
2. 业务后果可控：未经批准的结果不能进入高信任资产或触发受保护动作。
3. 内容事实正确：仍需要数据依据、确定性校验和人工判断，当前不能绝对保证。

- [ ] **Step 5: Write the Skill, AI shell, and n8n comparison**

Add one Markdown table covering core object, execution ownership, durable state, approval, output semantics, ecosystem, and production maturity. State that n8n is stronger in generic integration and production automation, while AgentCore OS is more opinionated about governed AI execution and business assets.

- [ ] **Step 6: Document implementation status and limitations**

State all of the following explicitly:

- Registered controlled playbooks: `sales-pipeline-v1` and `support-resolution-v1`.
- Durable state currently uses local JSON stores with locking and backups.
- Fixture replay is currently metadata-contract validation.
- Real LLM/tool replay is not implemented.
- The Python sidecar is still an adapter rather than a fully independent runtime.
- Current status is `local delivery demo ready`, not `production ready`.

- [ ] **Step 7: Add conclusion and publication metadata**

End with the approved conclusion that the system controls whether model mistakes can cross business boundaries. Add sections for a 100-160 Chinese-character summary, 6-10 keywords, and a Meta Description suitable for the website and CSDN.

- [ ] **Step 8: Inspect article length and structure**

Run:

```bash
wc -m docs/controlled-ai-execution-runtime.zh-CN.md
rg -n '^## ' docs/controlled-ai-execution-runtime.zh-CN.md
```

Expected: approximately 3,500-5,000 Chinese characters and sections covering the problem, architecture, controllability, comparisons, current state, limitations, conclusion, and publication metadata.

### Task 2: Verify technical claims and wording boundaries

**Files:**
- Modify: `docs/controlled-ai-execution-runtime.zh-CN.md`
- Reference: `docs/PROJECT_FRAMEWORK.zh-CN.md`
- Reference: `lobster-sidecar/README.md`
- Reference: `src/lib/executor/playbooks/catalog.ts`
- Reference: `src/lib/server/json-store.ts`

- [ ] **Step 1: Check required factual boundaries**

Run:

```bash
rg -n 'sales-pipeline-v1|support-resolution-v1|local delivery demo ready|production ready|metadata|真实 LLM|JSON|sidecar' docs/controlled-ai-execution-runtime.zh-CN.md
```

Expected: every current-state boundary appears explicitly in the article.

- [ ] **Step 2: Scan for prohibited absolute claims**

Run:

```bash
rg -n '彻底消除幻觉|完全没有幻觉|百分之百正确|绝对正确|保证模型不犯错|已经生产就绪' docs/controlled-ai-execution-runtime.zh-CN.md
```

Expected: no matches.

- [ ] **Step 3: Verify comparison language**

Confirm that the article does not describe AgentCore OS as an n8n replacement. It must state that n8n may serve as a connector and automation layer beneath or beside AgentCore OS.

- [ ] **Step 4: Verify repository links**

Inspect every relative Markdown link and confirm the target exists locally. Fix any link whose target does not resolve from the `docs/` directory.

### Task 3: Final publication check

**Files:**
- Modify: `docs/controlled-ai-execution-runtime.zh-CN.md`

- [ ] **Step 1: Check Markdown whitespace**

Run:

```bash
git diff --check -- docs/controlled-ai-execution-runtime.zh-CN.md
```

Expected: exit code 0 with no output.

- [ ] **Step 2: Review the rendered source structure**

Run:

```bash
sed -n '1,260p' docs/controlled-ai-execution-runtime.zh-CN.md
```

Expected: no placeholders, private filesystem paths, internal-only instructions, duplicated sections, or broken code fences.

- [ ] **Step 3: Commit the article**

```bash
git add docs/controlled-ai-execution-runtime.zh-CN.md
git commit -m "docs: publish controlled AI execution article"
```

Expected: one commit containing only the publishable article.

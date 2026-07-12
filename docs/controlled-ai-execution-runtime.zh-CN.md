# 让 AI 的幻觉止步于业务执行之前：AgentCore OS 如何让特定任务的过程、边界与最终落地结果可控

> 本文基于 AgentCore OS 截至 2026 年 7 月 12 日的工程状态，介绍我们为什么从 AI OS 壳转向 Controlled Skill / Playbook Runtime、这套体系与普通 Skill、AI 壳和 n8n 的区别，以及下一阶段的技术演进方向。

大模型进入真实业务后，最危险的问题往往不是它拒绝回答，而是它给出了一个形式正确、读起来合理、实际上没有依据的答案。

例如，一个销售 Agent 输出了下面的结果：

```json
{
  "priority": "high",
  "reasons": ["客户预算充足，采购时间明确"],
  "nextAction": "立即发送正式报价"
}
```

这段 JSON 符合 Schema，字段完整，语气确定。但如果原始询盘从未提供预算和采购时间，那么它仍然是一次事实层面的幻觉。如果系统随后自动创建报价、更新 CRM、发送邮件，并把结论写入企业知识库，一次看似微小的生成错误就会变成真实业务动作。

这也是 AgentCore OS 当前试图解决的问题：

> **模型输出不必绝对可靠，但系统必须保证不可靠的输出无法未经验证就成为真实业务事实。**

我们无法仅靠 Prompt 让模型永远不犯错，但可以控制错误能够传播到哪里、能够调用什么工具、何时必须停下来等待人工判断，以及什么结果有资格进入高信任业务资产。

## 从“模型会不会回答”转向“系统能不能可靠执行”

过去一段时间，大量 AI 产品围绕三个方向发展：更强的模型、更丰富的 Skill，以及更完整的桌面或聊天入口。这些能力都很重要，但它们分别解决的是不同问题。

模型解决“能不能生成”；Skill 解决“应该怎么做”；AI 壳解决“从哪里使用”。当 AI 真正进入销售、客服、研究、内容发布等流程时，还缺少第四层：**如何让它按经过确认的规则执行，并对执行后果负责。**

普通 Skill 通常由提示词、操作步骤、工具说明和输出格式组成。它可以把专家经验交给模型，却不天然提供持久运行状态、审批阻断、失败恢复、工具权限、审计记录和资产写回。模型仍可能临场调整步骤，也可能把“建议”理解成“允许执行”。

AI OS 壳则擅长组织窗口、应用、聊天和工具入口。它改善了交互体验，却不等于建立了执行控制。如果真正的状态只存在于浏览器组件里，刷新、断流或进程重启都可能让执行上下文丢失；如果审批只是界面上的一句提示，它也无法阻止后台继续运行。

因此，AgentCore OS 的工程主线已经从“多 App AI 工作台”调整为 **Controlled Skill / Playbook Runtime**。旧的桌面 UI、业务 App、Knowledge Vault 和 Solutions Hub 继续保留，但角色发生了变化：UI 是操作面，App 是业务面，Runtime 才是控制执行的核心。项目总纲对此有完整说明：[AgentCore OS 项目框架总纲](./PROJECT_FRAMEWORK.zh-CN.md)。

## AgentCore OS 的底层执行链路

当前受控运行链路可以概括为：

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

这不是让 LLM 自己规划一切的开放式循环，而是一个“确定性骨架包裹概率性节点”的执行系统。

**Playbook Resolver** 根据场景选择已经注册的受控 Playbook。当前正式注册的是销售流程 `sales-pipeline-v1` 和客服流程 `support-resolution-v1`，目录代码见 [playbooks/catalog.ts](../src/lib/executor/playbooks/catalog.ts)。

**Plan Validator** 在执行前检查步骤 ID、顺序、依赖、模式、工具调用和 Schema 是否与 Playbook 一致。增加步骤、交换顺序、替换工具或绕过审批都会导致验证失败，具体实现见 [playbooks/validator.ts](../src/lib/executor/playbooks/validator.ts)。

**Runtime State Machine** 保存 `running`、`awaiting_approval`、`completed`、`failed`、`cancelled` 等状态。运行状态不依赖某个 React 组件是否仍然打开。

**Step Runner** 按照验证后的顺序逐步执行，记录输入、输出、工具结果、尝试次数、Schema 校验结果和错误。模型可以在某一步生成内容，但不能默认决定下一步是什么。

**Tool Gateway** 把工具调用限制在 Playbook 声明的边界内。Playbook 步骤可以定义 `allowedTools`、`forbiddenTools` 和具体 `toolCalls`，而不是把所有本地或外部能力一次性暴露给模型。

**Approval Gate** 将 `review` 和 `manual` 步骤转化为真实的运行状态。执行到关键节点时，Run 进入 `awaiting_approval`；人工批准、拒绝和反馈都会成为持久记录，而不是一段没有约束力的 UI 文案。

**Trace Store** 保存计划、步骤、审批、工具结果、错误和写回凭证，使一次执行可以被复盘、脱敏导出和用于后续回归检查。

**Asset Writeback** 把通过条件的结果写入 `sales_asset`、`support_asset`、`knowledge_asset`、`draft` 或 `workflow_run`。中间步骤可以按 `on_success` 留下阶段性记录；最终受保护结果则通过 `after_approval` 路径写回，使过程资产与批准后的正式沉淀具有清晰边界。

**Runtime Console** 是这套系统的控制面，用来查看近期运行、待审批步骤、可重试失败、资产落点和 governed trace，而不只是显示聊天记录。

Playbook 的类型合同位于 [playbooks/types.ts](../src/lib/executor/playbooks/types.ts)。每个步骤都可以声明输入输出 Schema、执行模式、工具边界、验收标准、审批要求、失败策略和写回目标。这使业务 SOP 从一段“建议模型遵守的文字”变成 Runtime 可以验证和执行的合同。

## “结果可控”究竟是什么意思

讨论 AI 可控性时，最容易出现的问题是把不同层次混为一谈。对 AgentCore OS 来说，至少需要区分三件事。

### 1. 流程可控

流程可控指步骤、顺序、依赖、允许使用的工具、审批点和失败策略由 Playbook 与 Runtime 决定，而不是由模型临场发挥。

例如，销售流程必须依次完成询盘整理、线索判断、跟进草稿、人工审核和最终写回。模型不能因为“认为客户意向很强”就跳过审核，也不能把原本只允许生成草稿的步骤改成直接发送邮件。

这一层是当前体系控制力最强的部分。

### 2. 业务后果可控

业务后果可控指生成结果即使存在错误，也不能未经验证就触发受保护动作或进入高信任资产。

结构化草稿可以先保存在低信任区域，供人检查；涉及客户承诺、报价、政策例外、退款、正式回复和知识沉淀的结果，则需要经过审批或确定性规则。系统关注的不只是“模型说了什么”，更关注“这句话接下来能够造成什么后果”。

这一层是 AgentCore OS 与普通聊天产品最重要的区别。

### 3. 内容事实正确

内容事实正确是更难的问题。Schema 能确认输出有没有 `priority` 和 `reasons` 字段，却不能单独证明“客户预算充足”是真的；人工审批能够降低风险，也不代表审批者永远不会判断失误。

因此，AgentCore OS 不把结构校验描述成事实校验，也不把人工审批描述成正确性的终点。更完整的事实控制还需要：可追溯数据源、字段级引用、确定性业务规则、多源交叉验证、置信度策略，以及在证据不足时自动阻断执行。

准确地说，我们控制的不是模型是否产生错误，而是模型错误能否轻易越过业务边界。

## 为什么固定 Playbook 比“再写一层 Prompt”更可靠

Prompt 是软约束。它可以告诉模型“不要编造价格”，但不能单独阻止一个写入工具被调用，也不能保证进程重启后审批状态仍然存在。

受控 Playbook 则把关键约束移到模型之外：

- 步骤顺序由代码验证，而不是由模型记忆。
- 工具范围由 allowlist 和 guardrail 限制，而不是依赖自觉。
- 输出结构由 Schema 验证，不合格结果不能悄悄进入下一步。
- 审批是状态机节点，刷新或断流后仍可恢复。
- 写回产生结构化 receipt，可以知道哪个 Run 把什么结果写到了哪里。
- Playbook 带有版本、负责人、复审周期和变更策略，可以进入工程治理流程。

这并不意味着概率性生成消失了，而是意味着概率性生成被放进了一个确定性的业务容器中。

## AgentCore OS 与 Skill、AI 壳、n8n 的区别

| 维度 | 普通 Skill | AI OS / Agent 壳 | n8n | AgentCore OS |
|---|---|---|---|---|
| 核心对象 | Prompt、SOP、工具说明 | 会话、窗口、应用入口 | Node、Workflow、Credential | Playbook、Step、Approval、Trace、Asset |
| 主要目标 | 告诉模型如何完成一类任务 | 组织 AI 交互入口 | 连接系统并自动处理数据 | 约束 AI 按业务规则执行 |
| 谁决定步骤 | 通常由模型解释和规划 | 多数仍由 Agent 决定 | 工作流设计者通过节点连线决定 | 注册 Playbook 和 Runtime 决定 |
| 持久状态 | 通常由宿主提供 | 常以会话或前端状态为主 | 数据库、队列和执行历史较成熟 | 保存 Run、Step、Approval、Trace 和 Receipt |
| 人工审批 | 操作建议或宿主能力 | 经常是界面提醒 | 可通过 Wait、Form、Webhook 等实现 | 原生运行状态与恢复节点 |
| 输出语义 | 文本或结构化建议 | 聊天结果、文件 | JSON 和第三方系统数据 | 销售、客服、知识、草稿和 Workflow 资产 |
| 连接器生态 | 取决于宿主 | 取决于壳系统 | 成熟且广泛 | 当前仍在建设 |
| 当前生产成熟度 | 不适用或取决于宿主 | 差异较大 | 通用自动化能力成熟 | 当前为本地交付演示就绪 |

两者最容易被拿来比较的是 n8n，因为 n8n 同样可以执行固定流程、调用模型、等待人工输入、失败重试和写回外部系统。技术上，使用 n8n 的 AI 节点、数据库、Wait 和自定义节点，确实能够搭建出许多相似流程。

但二者的默认抽象不同。n8n 首先是通用自动化和系统集成平台，擅长回答“数据如何从 A 系统流向 B 系统”；AgentCore OS 首先关注受控 AI 业务执行，试图回答“这个 AI 结论依据什么、执行到哪里必须停、谁批准了它，以及它为什么可以成为可信资产”。

在工程成熟度上，n8n 当前明显更强：它拥有更丰富的连接器、更成熟的凭证管理、数据库与队列执行、部署扩容能力和生产案例。AgentCore OS 不应该把自己定位为另一个 n8n，更不应该在通用节点数量上与它竞争。

更合理的组合方式是：AgentCore OS 管理 Playbook、审批、Trace、业务资产和 AI 治理；n8n 作为其旁边或下层的连接器与自动化执行层，负责 SaaS 集成、Webhook、消息投递和跨系统同步。前者控制业务语义和信任边界，后者提供成熟的集成能力。

## 当前已经实现了什么

截至本文日期，AgentCore OS 已经形成受控 Runtime 的本地核心闭环：

- 销售和客服两条固定 Playbook 已注册并可执行。
- 执行前会校验步骤顺序、依赖、工具、模式和 Schema。
- Controlled Run、Step 和 Approval 具有持久记录。
- 客户端断流或审批中断后可以 Resume。
- 失败步骤可以根据策略 Retry 或进入人工处理。
- 批准后的结果可以写入销售、客服、知识、草稿和 Workflow 资产。
- Runtime Console 可以查看运行、审批、失败恢复、资产落点和脱敏 Trace。
- Playbook lifecycle、governed fixture 和发布证据已经具备一系列本地检查门禁。

当前服务端持久层以本地 JSON Store 为主，并实现了进程内互斥、跨进程锁、临时文件替换和备份恢复，见 [server/json-store.ts](../src/lib/server/json-store.ts)。这足以支撑本地优先的开发和交付演示，但不等同于面向大规模并发的数据库或分布式状态系统。

桌面端由 Tauri 启动本地 Python FastAPI sidecar，提供健康检查、状态存储、OpenClaw 兼容接口和 IM Bridge。当前 sidecar 仍是适配层，尚不是完全独立且与 Next.js 主线同构的 Skill Runtime，边界见 [lobster-sidecar/README.md](../lobster-sidecar/README.md)。

## 我们仍然没有完成什么

技术博客如果只描述目标、不描述边界，就会重复 AI 行业最常见的问题：把愿景写成现状。

AgentCore OS 当前状态是 **`local delivery demo ready`**，不是 **`production ready`**。核心受控链路已经成型，但仍有以下工作需要完成：

- 当前只有 `sales-pipeline-v1` 和 `support-resolution-v1` 两条正式受控 Playbook。
- Fixture replay 目前仍是 metadata 合约校验，不是一次真实模型与真实工具执行。
- 真实 LLM/tool replay 尚未实现。
- Replay 所需的凭证隔离、Store 隔离、审批模拟和副作用阻断仍需继续生产化。
- 本地 JSON 持久层需要向更强的事务、并发、保留和运维能力演进。
- Python sidecar 需要进一步缩小与主 Runtime 的能力差异。
- 外部 Connector、长期监控、事故处理和回滚证据仍需完善。

这些限制不会否定当前架构的价值，但决定了我们应该如何描述它：它是一套已经跑通关键控制闭环的本地优先 AI 业务 Runtime，而不是已经完成所有生产化工作的通用平台。

## 下一阶段：从受控执行闭环走向证据驱动的 AI Runtime

当前架构解决了“如何把模型放进受控流程”的基础问题。下一阶段，我们希望继续把控制力从流程层推进到事实层、运行层和组织治理层。下面这些能力属于明确的演进方向，其中一部分已有设计合同或原型，但尚不能视为当前生产能力。

### 1. Evidence-grounded Generation

未来的关键业务字段不应只有生成结果，还应携带来源、引用、时间和可信度。例如，“客户预算充足”必须指向询盘原文、CRM 字段或经过授权的数据源；找不到证据时，Runtime 应把字段标记为 `unknown` 或直接阻断后续步骤，而不是让模型补全一个听起来合理的答案。

### 2. 确定性 Validator 与 Policy Engine

Schema 负责验证结构，下一层 Validator 将负责验证业务规则：报价是否超出授权范围、订单是否存在、退款是否符合政策、知识引用是否过期。风险策略则根据动作、金额、数据敏感度和证据完整度决定自动执行、抽样复核、强制审批或拒绝执行。

### 3. 真实 Replay 与隔离沙箱

我们计划把当前 metadata replay 推进为真实 LLM/tool replay。在不触碰生产系统的条件下，重新执行历史 Run，比较模型版本、Prompt、Playbook 和工具变化带来的结果差异。Replay 环境需要具备凭证隔离、Store 隔离、审批模拟、副作用阻断、固定输入快照和可归属的结果 Artifact。

### 4. 生产级 Durable Runtime

本地 JSON Store 将继续服务本地优先场景，同时引入更适合团队和企业部署的事务存储、事件日志、幂等执行、任务队列、租约、保留策略和灾难恢复能力。Run、Approval、Trace 和 Asset Receipt 会形成统一的长期审计链，而不是分散在不同进程和界面状态中。

### 5. Playbook Authoring 与版本治理

未来用户将能够以可视化或声明式方式创建 Playbook，但编辑自由度仍受控制合同约束。版本发布需要经过 Schema 校验、工具权限复核、Fixture 回归、风险评审和迁移计划；正在运行的实例继续绑定原版本，新版本通过明确策略逐步生效。

### 6. Connector 与 n8n 协作层

AgentCore OS 不需要重复建设所有 SaaS 节点。未来 Tool Gateway 可以把 n8n Workflow、企业内部 API 和专用 Connector 注册为受控工具：AgentCore OS 决定何时允许调用、需要什么审批和如何记录证据，n8n 负责成熟的系统连接、消息投递与数据同步。

### 7. 风险自适应的人机协作

人工审批不会永远停留在“全部批准或全部拒绝”。Runtime 可以根据证据完整度、历史质量、动作风险和业务金额动态路由：低风险任务自动执行，中风险任务抽样检查，高风险任务要求双人复核。审批界面同时展示原始证据、模型结论、规则命中和即将发生的外部动作，让人审查的是决策依据，而不只是润色后的答案。

这条路线的目标不是让 Agent 获得无限自主权，而是让自动化程度随着证据质量和控制能力提高。系统越能证明一个结果为何可信，越可以安全地减少人工介入；无法证明时，则必须主动降级或停下。

## 结语：不要要求模型永不犯错，要让系统能够承受模型犯错

在真实业务里，把希望寄托在“下一代模型不会幻觉”上并不是可靠的工程策略。模型能力会继续提高，但输入缺失、数据冲突、工具异常、上下文污染和判断偏差不会一起消失。

更可行的方向是把不确定性当作系统前提：让模型负责它擅长的理解、提取、生成和建议，让 Runtime 负责步骤、权限、审批、状态、证据和业务后果。

这也是 AgentCore OS 从 AI OS 壳转向 Controlled Skill / Playbook Runtime 的原因。我们真正希望建立的不是一个看起来能做很多事的 Agent，而是一套知道何时可以自动执行、何时必须停下、什么结果可以被信任、出现问题后如何恢复的工作基础设施。

> **我们控制的不是模型是否犯错，而是模型犯错后能不能越过业务边界。**

## 发布摘要

AgentCore OS 通过固定 Playbook、工具边界、Schema、持久审批、可恢复运行、Trace 与业务资产写回，把大模型的概率性输出限制在可治理的执行环境中。它不承诺消除模型幻觉，而是阻止未经验证的结果直接成为业务事实，并与 n8n 等通用自动化平台形成互补。

## 关键词

AgentCore OS、AI 幻觉、AI Agent、Skill Runtime、Playbook Runtime、可控 AI、人工审批、n8n、企业自动化、业务工作流

## Meta Description

AgentCore OS 如何通过受控 Playbook、工具白名单、人工审批、持久 Trace 和业务资产写回，让 AI 在销售、客服等特定任务中的执行过程与最终落地边界可控，并与 Skill、AI OS 壳和 n8n 形成差异化定位。

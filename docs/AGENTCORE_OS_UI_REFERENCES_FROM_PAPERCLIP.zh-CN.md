# 智枢 OS UI 借鉴 Paperclip 的改造清单

这份清单的目的不是照抄 Paperclip，而是提炼它在“控制感、可信感、运行感、组织感”上的长处，融入智枢 OS 的新 UI。

原则：

- 学 Paperclip 的治理层表达
- 保留智枢 OS 的行业化、角色化、工作流化优势
- 不把智枢 OS 做成纯监控后台
- 不把产品做成只好看但不好用的暗色面板

## 总体结论

Paperclip 最值得学习的不是具体颜色或卡片样式，而是以下 5 种界面能力：

1. 控制感
2. 可信感
3. 可观测性
4. 组织与责任归属
5. 长流程追踪能力

智枢 OS 最应该借鉴的是这些“系统语言”，而不是把自己变成运维控制台。

## 我们应该学的东西

### 1. 首页要更像 Mission Control

智枢 OS 首页现在应该继续强化成“总控台”，而不是单纯欢迎页或 app 入口页。

建议增加这些模块：

- 今日最重要目标
- 当前活跃工作流
- 待审批风险事项
- 本地运行状态
- 连接器/侧车状态
- 资产沉淀摘要
- 预算或资源消耗摘要
- 最近失败与待恢复任务

要点：

- 用户一上来先看到“正在发生什么”和“下一步做什么”
- 不要先看到一堆功能
- 要先看到工作、状态、风险、机会

### 2. 工作流页面要更像真实运行控制台

Paperclip 值得学的是它把 agent 运行过程做成了“可追踪对象”。

智枢 OS 的 Workflow Console 建议强化这些结构：

- workflow trigger
- runtime status
- stage status
- current owner
- human approval checkpoint
- retry / resume
- write-back target
- related assets
- related records
- execution log summary

要点：

- 工作流不是流程图，而是正在跑的业务对象
- 用户应该知道现在卡在哪、下一步是谁做、结果写到哪里

### 3. 审批中心要更像决策面板

Paperclip 的治理感很强，这一点非常值得学。

智枢 OS 的 Approval Center 建议增加：

- 风险等级
- 影响范围
- 来源工作流
- 建议动作
- 上下文摘要
- 审批后写回位置
- 谁可以审批
- 审批历史

要点：

- 不只是“Approve / Deny”
- 要让审批成为一项有上下文的业务决策
- 看起来要可信、专业，不要像普通通知列表

### 4. 资产库要更像“可复用成果中心”

Paperclip 强调追踪和组织；智枢 OS 更应该把结果沉淀放大。

Asset Vault 建议加强：

- 资产来源 workflow
- 资产类型
- 可复用场景
- 最近使用次数
- 最近更新时间
- 关联客户/项目/行业
- 一键复用入口
- 相关模板与派生版本

要点：

- 资产库不是文件夹
- 要让用户感觉“做过的事会留下价值”

### 5. 增加组织与责任归属语言

Paperclip 很强的一点是 org chart 和责任感。

智枢 OS 不一定要直接做完整组织图，但 UI 可以加入：

- 当前角色
- 当前 workspace
- 当前 owner
- 任务责任人
- 审批责任人
- 资产归属
- 工作流发起者

要点：

- 界面里要看得出“谁负责”
- 这样系统会更像真实公司系统，而不是匿名 AI 平台

### 6. 增加运行健康与恢复能力的界面

Paperclip 让系统看起来能长期运行，这一点对智枢 OS 很重要。

建议加入这些 UI 元素：

- runtime health strip
- connector health
- queue / job status
- recent errors
- retry actions
- last sync time
- write-back confirmation

要点：

- 这些信息不要像开发者 debug panel
- 要做成高可信、低打扰的系统状态层

## 我们不能照搬的东西

### 1. 不能把智枢 OS 做成 infra dashboard

Paperclip 更像 orchestration control plane。
智枢 OS 更像 business operating system。

所以不能让页面只剩：

- logs
- metrics
- health
- task traces

还必须保留：

- 行业入口
- 角色工作台
- 业务动作
- 工作流推进
- 资产沉淀

### 2. 不能过度黑客风

Paperclip 那种“黑底 + 系统字 + 高频状态条”的感觉可以借一点，
但不能做成太冷、太硬、太工程化。

智枢 OS 需要：

- 更好的品牌感
- 更强的业务可读性
- 更适合销售、内容、研究、客服等角色的工作气质

### 3. 不能让组织治理压过业务执行

治理重要，但用户最终还是来做工作，不是只来管理机器人。

所以所有治理层 UI 都应该服务于：

- 更快做事
- 更稳做事
- 更可控做事

## 对 Stitch 的具体优化要求

如果要继续给 Stitch 反馈，可以让它重点吸收 Paperclip 的这些优点：

### 首页

- 学它的 mission control 感
- 学它的状态可信感
- 学它的运行健康概览
- 但保留智枢 OS 的行业入口和角色入口

### 工作流页

- 学它的 runtime + stage 双层状态
- 学它的 retry / resume / pause 思维
- 学它的 trace / audit 结构
- 但页面必须仍然服务业务执行，不是纯监控

### 审批页

- 学它的治理感和风险感
- 学它的上下文充分展示
- 审批页要像“决策台”，不是消息提醒页

### 资产页

- 学它的对象化管理方式
- 但更强调复用、派生、沉淀，而不是单纯记录

### 二级页和三级页

- 学它的 detail page 完整度
- 每个 detail page 都要有 status、owner、timeline、related objects
- 但要保留智枢 OS 的业务语义和美观度

## 最推荐新增到智枢 OS 的 UI 结构

优先建议增加这 10 个结构：

1. 顶部系统状态条
2. Workspace / Team / Role 切换器
3. Runtime Health 条带
4. Workflow Trace 面板
5. Approval Context Panel
6. Asset Lineage 视图
7. Owner / Responsibility 显示
8. Retry / Resume / Recovery 入口
9. Recent Errors / Recovery Queue
10. Write-back Destination 反馈

## 最终目标

最终的智枢 OS UI 应该做到：

- 比 Paperclip 更有业务工作台气质
- 比一般 AI 产品更可控、更可信
- 比传统后台更现代、更高级
- 比纯 workflow 工具更像完整 OS
- 比单个 agent 工具更像真实的公司工作系统

## 一段可直接发给 Stitch 的补充话术

Please borrow the strongest UI ideas from Paperclip, especially its control-plane clarity, observability, governance feel, runtime trust, ownership visibility, and long-running workflow traceability. However, do not turn AgentCore OS into an infra dashboard. Keep AgentCore OS as a business operating system with strong industry entry, role-based desks, workflow execution, approvals, and asset accumulation. Add mission-control level runtime trust, approval context, health surfaces, retry/resume logic, ownership visibility, and write-back destinations, but preserve spacious business workbench layouts and premium product aesthetics.

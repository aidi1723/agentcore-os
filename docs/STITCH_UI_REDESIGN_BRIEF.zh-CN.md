# AgentCore OS Stitch UI 重设计 Brief

这个文档用于直接喂给 Google Stitch，目标是为 AgentCore OS 生成一套全新的高保真 UI 方案。

## 你要设计的产品

AgentCore OS 是一个本地优先、面向真实工作的 AI 工作底座。
它不是普通聊天工具，也不是单一 SaaS 面板，而是一个桌面式 AI 业务操作系统。

产品关键词：

- local-first
- AI work operating system
- industry solution OS
- multi-window desktop shell
- role-based workbench
- workflow orchestration
- human approval boundaries
- reusable assets and memory

## AgentCore OS 的核心优势

请把下面这些优势明确体现在界面里，而不是只在文案里提一下：

- 本地优先：用户感知到数据、配置、工作流和资产优先掌握在自己手里
- 可控边界：系统会明确区分自动执行、AI 辅助、待人工审批、受限动作
- 多工作流协同：不是单次对话，而是跨应用、跨任务的连续工作系统
- 资产可沉淀：每次工作都能留下模板、知识、脚本、客户跟进结构、发布资产
- 面向真实业务：覆盖销售、内容、研究、客服、招聘、运营等真实工作场景
- 桌面级效率：多窗口、命令入口、状态区、任务切换，而不是单页来回跳转
- 行业化与角色化：用户进入的是行业解决方案和角色工作台，而不是工具堆

这些优势必须被转化为可见的界面语言，比如：

- 本地运行状态卡
- 审批边界标签
- 工作流阶段轨道
- 最近沉淀资产区
- 角色工作台的默认任务面板
- 行业 solution 的推荐入口

## 必须表现出来的系统特质

请让用户在视觉和交互上明确感知到这些特质：

- 操作效率：常用动作路径短，切换快，恢复上下文快
- 系统稳定性：界面秩序清楚、状态反馈可靠、不会让人觉得脆弱或实验性太强
- 产品可信度：像能长期使用的工作系统，而不是一次性的演示 UI
- 流程完整性：每个任务不是停留在生成，而是有进入、执行、审批、沉淀、回看
- 技能协同感：多个能力模块像同一套系统在协同，而不是彼此独立的小工具

## 当前产品问题

当前界面更像“很多 AI app 摆在一个桌面上”：

- 入口层级不够清晰
- 用户先看到 app，而不是行业、角色、工作流
- 视觉语言偏通用 glassmorphism，记忆点不足
- 缺少强烈的“业务操作系统 / 指挥台”感
- 缺少对 AI / Human 边界、审批状态、流程阶段的视觉强调
- 常见动作的优先级不够清楚，操作起点不够明确
- 用户还需要思考“该开哪个工具”，而不是直接进入任务

## 新设计的目标

请为 AgentCore OS 设计一套全新的桌面应用 UI，核心目标不是把界面做得更炫，而是让用户一眼看懂：

1. 我属于哪个行业或业务场景
2. 我现在以什么角色进入系统
3. 我应该先跑哪个工作流
4. 哪些步骤是 AI 自动执行，哪些步骤需要人工确认
5. 哪些结果会沉淀为可复用资产
6. 当前系统是否在本地正常运行、是否有待审批风险
7. 我最短路径下一步应该点哪里

## 产品方向

这不是“App Center”。
这是“Solution OS”。

设计必须体现 3 层主入口：

1. Industry
2. Role
3. Workflow

App 仍然存在，但它们应退到二级位置，作为工作流中的执行模块，而不是首页主角。

## 现有核心产品结构必须融入新 UI

新 UI 不是推翻现有产品能力，而是把它们重组得更清晰、更高级。

请显式融入这些核心结构：

- 行业入口：内容与创作者、销售与增长、客服与用户成功、研究与策略、招聘与人才、项目与运营、个人与家庭
- 角色工作台：CEO、Sales、Ops、Research、Creator、Recruiting 等角色视角
- Workflow Console：把真实任务按阶段推进，而不是停留在静态卡片
- Asset Vault / Knowledge Vault：承接知识、模板、跟进结构、发布资产等沉淀
- Approval Center：清晰管理待审批与高风险动作
- Command Bar / Spotlight：作为统一的高效入口
- Multi-window Desktop Shell：保留桌面壳效率，但更统一、更成熟

请特别把“行业选择 + 角色进入 + 工作流推进 + 资产沉淀”设计成一条连续主线。

## Hero Workflow 必须可见

AgentCore OS 不是只展示很多页面，而是要体现“至少有一条真正能跑通的工作流”。

请在方案里明确展示 Hero Workflow 思维，尤其推荐体现销售场景：

- Trigger：例如询盘、线索进入、表单、手动启动
- Runtime State：idle / running / awaiting_human / completed / error
- Stage State：pending / running / awaiting_human / completed / error
- Asset Landing：CRM 记录、邮件草稿、跟进结构、知识资产、可复用 playbook

请让 Stitch 把这类工作流状态设计成真正的系统骨架，而不是装饰性时间线。

## 设计优先级

如果必须取舍，请按这个顺序做设计决策：

1. 更容易开始
2. 更容易理解下一步
3. 更容易看懂 AI / Human 边界
4. 更容易跨工作流切换
5. 更容易回看和复用资产
6. 最后才是单纯的视觉炫技

## 视觉方向

请不要做成典型的浅色 SaaS 仪表盘，也不要做成普通 macOS 拟态。

希望的气质：

- 像“AI 指挥台 + 桌面操作系统 + 业务战情室”
- 有明显的品牌态度，克制但不平庸
- 专业、可信、现代，但不冷冰冰
- 更像“mission control for work”而不是“AI 玩具箱”

建议视觉关键词：

- editorial tech
- operational cockpit
- premium utility
- structured depth
- calm confidence

额外要求：

- 要比当前版本明显更高级、更精致
- 要比当前版本明显更易操作、更少迷路
- 要有品牌记忆点，但不要影响效率

## 视觉限制

请避免：

- 紫色主导的通用 AI 风格
- 纯白背景 + 蓝紫渐变按钮的模板感
- 过度圆润、过度可爱、像消费级效率工具
- 满屏玻璃拟态导致信息层级混乱

## 推荐视觉系统

可以尝试下面这类方向：

- 深石墨 / 墨绿 / 暗青 / 冷灰作为主基底
- 少量高识别度强调色，例如酸性青绿、信号橙、冷金属蓝
- 使用明显的信息层级、面板分区和状态色
- 字体上更有态度，不要只用系统默认风格
- 背景可以有微妙颗粒、雷达网格、场景光晕、数据线框元素

请特别让以下对象看起来有“系统级可信度”：

- 审批中心
- 工作流状态
- 本地运行状态
- 资产库
- 指令入口

## 必须产出的核心界面

请至少设计以下 10 个核心界面：

1. 登录后主入口 / Home Command Deck
   不是 app icon 桌面陈列，而是“解决方案入口 + 今日重点 + 待处理工作流 + 风险/审批”

2. Industry 选择界面
   例如内容增长、销售跟进、招聘、研究策略、CEO 指挥台、客服支持

3. Role Desk 界面
   例如 CEO、Sales、Ops、Research、Creator、Recruiting
   每个角色要有自己的指标、任务、快捷动作、推荐工作流

4. Workflow Console
   强调阶段推进、当前状态、AI 执行中、待人工确认、失败重试、结果资产化

5. Multi-window Desktop Shell
   保留桌面操作系统感，但更成熟、更统一
   包括顶部系统状态区、左侧或底部导航、窗口层级、快速切换、命令入口

6. Spotlight / Command Bar
   用于打开工作流、应用、命令和 AI 指令
   需要非常强的效率感

7. Asset Vault / Knowledge Library
   展示模板、知识卡、跟进脚本、内容资产、工作流结果沉淀

8. Approval Center
   展示 Awaiting Human Approval、AI Assisted、Auto Run、Restricted 等执行边界

9. Daily Brief / Today Overview
   汇总今天最重要的待办、待审批、工作流进度、最新资产、风险提示

10. Workspace Switcher
   在不同行业 solution 和角色 desk 之间快速切换

## 二级页面与三级页面要求

请不要只设计一级首页。
需要把二级页面、三级页面也纳入统一设计系统，并保持同样的完成度。

二级页面示例：

- 某个行业 solution 主页
- 某个角色 desk 首页
- 某个工作流列表或工作流详情页
- 某个资产库分类页
- 某个审批中心分类页

三级页面示例：

- 单个 workflow run 详情页
- 单个 stage 详情页
- 单个资产详情页
- 单个客户 / 线索 / 项目记录详情页
- 单个应用模块的执行页

要求：

- 不同层级页面要明显属于同一套产品
- 保持统一的版式规律、色彩语言、组件系统、间距和状态设计
- 一级、二级、三级页面都要兼顾美观与高信息密度
- 详情页不能塌陷成普通后台表单页，要保持品牌感和系统感

## 界面结构要求

请把产品从“桌面上很多图标”重构为以下信息架构：

- 顶层：Home / Solutions / Roles / Workflows / Assets / Approvals / Settings
- 二层：具体行业 solution
- 三层：角色工作台
- 四层：工作流执行与结果沉淀

App 图标区可以存在，但必须降级为辅助入口。

请确保用户可以从任一层级自然返回上一级，并保持上下文不丢失。

## 操作便捷性要求

新界面必须比当前版本更容易操作，请明确优化这些点：

- 用户进入首页后 3 秒内就知道从哪里开始
- 高频操作不超过 1 到 2 次点击
- 常用工作流有显著主按钮和上下文推荐
- 打开工作流、继续未完成工作、查看待审批，应该比“找 app”更靠前
- 命令入口要足够醒目，支持“打开应用、打开工作流、执行指令、跳转资产”
- 窗口切换和任务恢复要足够顺畅，避免用户丢失上下文
- 长信息密度界面也要保持层级清晰，不要只追求炫酷
- 尽量减少让用户做“先决定用哪个工具”的思考成本
- 用户从行业页进入角色页，再进入工作流页，路径要自然顺滑
- 二级和三级页面要有清晰的返回、面包屑或上下文导航
- 相似动作在不同页面位置要一致，避免每页重新学习

## 首页必须包含的信息模块

- 今日焦点
- 推荐进入的解决方案
- 当前角色身份
- 正在运行的工作流
- 待审批事项
- 最近沉淀的资产
- 系统状态和本地运行状态
- 快速命令入口
- 继续上次未完成工作
- 最值得推进的下一个动作

## Workflow Console 必须有的状态

- Auto Run
- AI Assisted
- Awaiting Human Approval
- Human Finalization
- Completed
- Failed
- Retryable

这些状态必须有明确、统一、非常直观的视觉语言。
请把这些状态设计得像“操作系统级状态”，不要像普通 tag。

请同时展示：

- 工作流整体运行状态
- 各阶段的单独状态
- 当前阻塞点
- 下一步建议动作
- 结果将沉淀到哪里

## 桌面感要求

虽然要从 app 导向升级为 solution OS，但不要完全丢掉桌面壳特征。

请保留并重设计这些能力：

- 多窗口
- 可聚焦的活动窗口
- 命令面板
- 系统托盘 / 状态区
- 任务切换
- 模块化工作区

目标是：
既像操作系统，又像业务指挥台。

## 必须体现的产品心智

用户看到界面时应该自然产生这些认知：

- “这是我工作的主控台”
- “我不用自己拼工具链，系统已经给我组织好了”
- “AI 能做什么、哪些要我审批，一眼就能看懂”
- “我的结果不会丢，会沉淀成以后能复用的资产”
- “这套系统是可控的，不是黑盒”
- “它是稳定可靠的业务系统，不是试验性质的 AI 页面”

## 用户体验要求

- 第一眼就能理解自己从哪里开始
- 降低“先打开哪个 app”的迷茫感
- 强调下一步建议，而不是功能堆叠
- 让用户随时知道哪些是 AI 在做，哪些需要自己拍板
- 让工作结果自然沉淀为资产，而不是一次性产物
- 让用户优先推进高价值动作，而不是浏览功能
- 让用户感到系统是“协助完成工作”，不是“展示很多能力”

## 设计输出要求

请输出高保真桌面应用 UI 方案，至少包含：

- 1 个完整的 Home Command Deck
- 1 个 Industry 选择页
- 1 个 Role Desk 页
- 1 个 Workflow Console 页
- 1 个 Asset Vault 页
- 1 个 Approval Center 页
- 1 个 Daily Brief 页
- 1 个 Workspace Switcher 视图
- 1 套多窗口桌面壳样式
- 1 套 Spotlight / Command Bar 样式
- 至少为二级页面和三级页面各给出 2 到 3 个高保真样例
- 说明不同层级页面如何保持一致的设计语言

## 组件风格要求

请定义这些组件的统一风格：

- side navigation
- workspace switcher
- workflow timeline
- approval cards
- asset cards
- AI status chips
- top status bar
- command palette
- floating windows
- empty states
- next-step recommendation cards
- local runtime status cards
- workflow resumption cards
- industry solution tiles
- role desk headers
- subpage section headers
- detail panes
- breadcrumb or contextual back navigation
- stable status banners
- runtime health surfaces

## 设备与布局要求

- 优先桌面端，适配大屏工作台
- 同时考虑 1440px 宽和 1728px 宽场景
- 不要求先做移动端主视图，但组件应具备一定响应式逻辑

## 品牌语言

品牌不是“可爱 AI 助手”。
品牌感应该偏向：

- 强执行力
- 高可信度
- 低噪音
- 面向专业工作
- 有战略感和操作感

品牌感可以参考：

- 比传统 AI 产品更稳
- 比普通企业软件更有气质
- 比常见效率工具更像真正的工作系统

## 交互动效建议

- 页面初次进入时有分层 reveal 动效
- Workflow 状态切换有明确反馈
- Command Bar 出现和收起要利落
- 不要做泛滥的微动效
- 动效服务于“系统正在运转”的感觉

## 可实现性与稳定运行约束

这个设计最终要回到真实前后端系统里运行，所以请遵守下面的约束：

- 不要依赖极其复杂、难以工程化的炫技交互
- 不要设计大量必须实时 3D 渲染或高性能 GPU 才能成立的界面
- 不要让核心信息只靠 hover 才可见
- 不要设计会严重破坏桌面多窗口逻辑的导航方式
- 不要把整个系统改成无法映射到现有页面结构的全新信息模型

请输出“高保真但可实现”的方案，要求：

- 能映射到现有前端组件和页面结构
- 能兼容多窗口桌面壳
- 能兼容工作流状态、审批状态、资产库、行业页、角色页
- 不牺牲现有功能可用性
- 不为了视觉而影响稳定运行

请记住：

- 新 UI 要服务功能，而不是压过功能
- 视觉升级不能破坏前后端逻辑
- 界面必须让功能更清楚、更易操作、更稳定可信

## 输出时请顺带说明

请在方案里简单说明：

- 这套 UI 如何体现 AgentCore OS 的产品优势
- 它如何比当前“app 桌面化”方案更易用
- 你如何处理 Industry / Role / Workflow 三层入口关系
- 你如何让审批、状态、资产沉淀更直观
- 你如何保证二级、三级页面也统一且美观
- 你如何确保设计可以被真实实现并稳定运行

## 请特别注意

这个产品是：

- 本地优先
- 可控审批
- 多工作流协同
- 面向真实业务

因此请不要把它设计成：

- 聊天机器人网站
- 单页营销官网
- 普通 BI 大屏
- 通用项目管理软件
- 纯 app launcher

## 一段可直接使用的生成指令

Design a premium desktop AI operating system UI for AgentCore OS, a local-first work platform for real business execution. Do not design a generic SaaS dashboard, chat app, or app launcher. Reframe the product from an app-centered desktop into a solution operating system organized by Industry, Role, and Workflow. The UI must clearly express AgentCore OS advantages: local-first control, visible human approval boundaries, coordinated multi-workflow execution, reusable asset accumulation, system stability, and desktop-grade operational efficiency. Make it significantly more beautiful, more premium, and easier to operate than a typical glassmorphism AI desktop. The interface should feel like a mission control cockpit for AI-assisted business work: structured, high-trust, operational, stable, and strategically calm. Integrate concrete product structures such as industry selection, role desks, workflow execution, approval center, asset vault, command bar, and multi-window desktop shell. Show that the system supports real workflows, especially hero workflow thinking with triggers, runtime states, stage states, human approval checkpoints, and asset landing. Create a dark editorial-tech visual system with strong hierarchy, premium typography, obvious next-step guidance, clear workflow state surfaces, local runtime status panels, reusable asset views, and refined desktop navigation. The design must cover top-level pages as well as consistent second-level and third-level pages, with a unified design system across overview pages, detail pages, workflow run pages, asset detail pages, and approval detail pages. Prioritize reducing decision friction so users instantly know where to start, what to do next, what AI is handling, what needs human approval, and where results are saved. Keep the design realistically implementable in a production frontend/backend system: do not rely on impossible interactions, do not break multi-window logic, and do not sacrifice functionality for aesthetics. Include screens for Home Command Deck, Industry selector, Role Desk, Workflow Console, Asset Vault, Approval Center, Daily Brief, Workspace Switcher, second-level pages, third-level detail pages, and a redesigned Spotlight command interface. Preserve the desktop OS feeling while making it feel more strategic, more business-native, more controllable, more stable, and far less like a collection of isolated AI tools.

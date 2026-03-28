import type { AppId } from "@/apps/types";
import type { AssetJumpTarget } from "@/lib/asset-jumps";
import type { BriefRecord } from "@/lib/briefs";
import type { ContentRepurposerProject } from "@/lib/content-repurposer";
import type { CreatorAssetRecord } from "@/lib/creator-assets";
import type { DealRecord } from "@/lib/deals";
import type { InboxDigest, InboxItem } from "@/lib/inbox";
import type {
  RecommendationAction,
  RecommendationHit,
  RecommendationResult,
  RecommendationSection,
} from "@/lib/recommendation-contract";
import type { ResearchAssetRecord } from "@/lib/research-assets";
import type { ResearchReportRecord } from "@/lib/research-hub";
import type { SalesAssetRecord } from "@/lib/sales-assets";
import type { SupportAssetRecord } from "@/lib/support-assets";
import type { SupportTicket } from "@/lib/support";

function truncateText(value: string, maxLength = 180) {
  const text = value.trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
}

function buildRecordJumpTarget(
  appId: AppId,
  eventName: string,
  idKey: string,
  idValue?: string,
): AssetJumpTarget | undefined {
  if (!idValue) return undefined;
  return {
    kind: "record",
    appId,
    eventName,
    eventDetail: { [idKey]: idValue },
  };
}

function buildResult(query: string, sections: Array<RecommendationSection | null>, recommendedAction: RecommendationAction) {
  return {
    contractVersion: "v1",
    query,
    sections: sections.filter((section): section is RecommendationSection => Boolean(section)),
    recommendedAction,
  } satisfies RecommendationResult;
}

function compactHits(hits: Array<RecommendationHit | null>) {
  return hits.filter((hit): hit is RecommendationHit => Boolean(hit));
}

export function buildDealDeskSurfaceRecommendation(input: {
  deal: DealRecord | null;
  asset?: SalesAssetRecord | null;
}): RecommendationResult {
  const deal = input.deal;
  const asset = input.asset ?? null;
  if (!deal) {
    return buildResult(
      "deal-desk",
      [],
      {
        kind: "select_deal",
        label: "先选择一条线索",
        rationale: "当前还没有选中的线索，先绑定具体客户上下文，再判断是否值得推进。",
      },
    );
  }

  const jumpTarget = buildRecordJumpTarget("deal_desk", "openclaw:deal-desk-select", "dealId", deal.id);
  const missingFields = [
    !deal.contact.trim() ? "联系人" : "",
    !deal.productLine.trim() ? "产品线" : "",
    !deal.need.trim() ? "需求描述" : "",
    !deal.budget.trim() ? "预算范围" : "",
    !deal.timing.trim() ? "时间窗口" : "",
  ].filter(Boolean);

  const riskHits: RecommendationHit[] =
    missingFields.length > 0
      ? missingFields.slice(0, 3).map((field, index) => ({
          kind: "missing_context",
          id: `deal-missing-${field}-${index}`,
          title: `补齐${field}`,
          summary: `当前这条线索还缺少 ${field}，会直接影响资格判断和后续邮件推进。`,
          score: 82 - index * 4,
          rationale: "销售闭环先卡在输入质量，信息缺口越大，后续提案和跟进越容易失真。",
          metadata: ["线索信息待补齐"],
          jumpTarget,
        }))
      : [
          {
            kind: "coverage_signal",
            id: `${deal.id}-context-covered`,
            title: "关键输入已基本齐全",
            summary: "联系人、需求、预算和时间窗口已具备主判断条件，可以进入简报或外联动作。",
            score: 72,
            rationale: "这意味着当前不该继续补表单，而是开始做判断和后续动作编排。",
            metadata: ["可进入判断阶段"],
            jumpTarget,
          },
        ];

  const action: RecommendationAction = !deal.brief.trim()
    ? missingFields.length >= 2
      ? {
          kind: "collect_deal_context",
          label: "先补齐线索关键信息",
          rationale: "当前缺口还比较大，直接生成资格简报只会放大猜测，应先补联系人、预算、需求或时间窗口。",
          jumpTarget,
        }
      : {
          kind: "generate_sales_brief",
          label: "先生成资格简报",
          rationale: "输入已经足够支撑第一轮判断，先把是否值得推进、风险点和下一步动作压成简报。",
        }
    : deal.reviewNotes.trim()
      ? {
          kind: "review_sales_brief",
          label: "先处理 Reality Checker 提醒",
          rationale: "资格简报已经生成，但仍有复核意见未处理。先把推断边界和遗漏点修正，再进入外联动作。",
          jumpTarget,
        }
      : {
          kind: "handoff_sales_outreach",
          label: "送入 Email Assistant",
          rationale: "资格判断已经具备足够上下文，下一步应生成首轮跟进邮件，而不是继续停留在判断阶段。",
        };

  return buildResult(
    deal.company || deal.contact || "deal-desk",
    [
      {
        id: "deal_context",
        label: "线索信号",
        hits: [
          {
            kind: "deal",
            id: deal.id,
            title: deal.company || deal.contact || "当前线索",
            summary: truncateText(deal.need || asset?.requirementSummary || "当前还没有填写足够的客户需求。"),
            score: deal.stage === "qualified" ? 84 : deal.stage === "proposal" ? 88 : 72,
            rationale: "这条线索是当前销售判断和后续外联动作的上下文中心。",
            metadata: [
              deal.inquiryChannel ? `来源 ${deal.inquiryChannel}` : "",
              deal.productLine ? `产品 ${deal.productLine}` : "",
              deal.preferredLanguage ? `语言 ${deal.preferredLanguage}` : "",
              `阶段 ${deal.stage}`,
            ].filter(Boolean),
            jumpTarget,
          },
        ],
      },
      {
        id: "deal_risks",
        label: "缺口与风险",
        hits: riskHits,
      },
      {
        id: "deal_brief",
        label: "简报与后续",
        hits: compactHits([
          deal.brief.trim()
            ? {
                kind: "sales_brief",
                id: `${deal.id}-brief`,
                title: "资格简报已生成",
                summary: truncateText(deal.brief),
                score: 78,
                rationale: "资格判断已经落成文本，可以直接进入人工复核和外联动作。",
                metadata: ["可进入外联阶段"],
                jumpTarget,
              }
            : {
                kind: "sales_brief_pending",
                id: `${deal.id}-brief-pending`,
                title: "尚未形成资格简报",
                summary: "当前还没有把输入压成结构化判断，销售动作容易停留在原始线索层。",
                score: 70,
                rationale: "先把是否值得推进、缺口和风险写清楚，后续动作才有稳定依据。",
                metadata: ["待生成简报"],
                jumpTarget,
              },
          deal.reviewNotes.trim()
            ? {
                kind: "reality_check",
                id: `${deal.id}-review`,
                title: "Reality Checker 仍有提醒",
                summary: truncateText(deal.reviewNotes),
                score: 86,
                rationale: "这里直接暴露了当前简报里最值得先修正的边界和风险。",
                metadata: ["待人工复核"],
                jumpTarget,
              }
            : asset?.nextAction || deal.workflowNextStep
              ? {
                  kind: "workflow_next_step",
                  id: `${deal.id}-next-step`,
                  title: "下一步动作",
                  summary: truncateText(asset?.nextAction || deal.workflowNextStep || ""),
                  score: 76,
                  rationale: "资格判断之后最重要的是避免上下文掉地，显式下一步能减少 handoff 丢失。",
                  metadata: [asset?.status ? `资产状态 ${asset.status}` : "等待外联"],
                }
              : null,
        ]),
      },
    ],
    action,
  );
}

export function buildContentRepurposerSurfaceRecommendation(input: {
  project: ContentRepurposerProject | null;
  asset?: CreatorAssetRecord | null;
}): RecommendationResult {
  const project = input.project;
  const asset = input.asset ?? null;
  if (!project) {
    return buildResult(
      "content-repurposer",
      [],
      {
        kind: "select_repurpose_project",
        label: "先选择一个内容拆解项目",
        rationale: "当前还没有选中的内容项目，先绑定具体选题或长内容，再决定生成内容包还是送去发布。",
      },
    );
  }

  const jumpTarget = buildRecordJumpTarget(
    "content_repurposer",
    "openclaw:content-repurposer-select",
    "projectId",
    project.id,
  );
  const suggestedPlatforms = project.workflowSuggestedPlatforms ?? [];
  const hasPack = project.contentPack.trim().length > 0;
  const hasSource = project.sourceContent.trim().length > 0;
  const action: RecommendationAction = !hasSource && !hasPack
    ? {
        kind: "collect_content_source",
        label: "先补充源内容",
        rationale: "当前还没有足够的原始内容，直接进入拆解只会得到空洞模板，先补逐字稿、摘要或观点笔记。",
        jumpTarget,
      }
    : !hasPack
      ? {
          kind: "generate_content_pack",
          label: "先生成内容包",
          rationale: "原始内容已经存在，但还没有形成可投递版本，先把多平台内容包压出来再进入 Publisher。",
        }
      : asset?.retryablePlatforms?.length
        ? {
            kind: "repair_creator_preflight",
            label: "先处理失败平台",
            rationale: "当前内容链已经出现可重试平台，先修正平台差异和权限问题，再继续发布更划算。",
          }
        : {
            kind: "route_content_to_publisher",
            label: "送去 Publisher 预演",
            rationale: "内容包已经具备投递基础，下一步应检查标题、CTA 和平台差异，而不是继续停留在拆解层。",
          };

  return buildResult(
    project.title || "content-repurposer",
    [
      {
        id: "repurpose_context",
        label: "源内容信号",
        hits: [
          {
            kind: "repurpose_project",
            id: project.id,
            title: project.title || "当前内容项目",
            summary: truncateText(project.sourceContent || project.workflowSourceSummary || "当前还没有填写足够的源内容。"),
            score: hasSource ? 82 : 70,
            rationale: "内容拆解的质量先取决于原始输入是否足够具体，而不是后面补多少提示词。",
            metadata: [
              `来源 ${project.sourceType}`,
              project.audience ? `受众 ${project.audience}` : "",
              project.goal ? `目标 ${project.goal}` : "",
            ].filter(Boolean),
            jumpTarget,
          },
        ],
      },
      {
        id: "repurpose_pack",
        label: "内容包状态",
        hits: compactHits([
          hasPack
            ? {
                kind: "content_pack",
                id: `${project.id}-pack`,
                title: "内容包已生成",
                summary: truncateText(project.contentPack),
                score: 84,
                rationale: "当前已经形成多平台可操作内容块，下一步应进入挑版本和预演，而不是继续停留在源内容录入。",
                metadata: ["可进入预演阶段"],
                jumpTarget,
              }
            : {
                kind: "content_pack_pending",
                id: `${project.id}-pack-pending`,
                title: "尚未生成内容包",
                summary: "当前还没有把长内容压成短视频、社媒帖子或 newsletter 版本。",
                score: 74,
                rationale: "先产出内容包，后续草稿保存、分平台发布和工作流 handoff 才有稳定输入。",
                metadata: ["待生成内容包"],
                jumpTarget,
              },
          project.workflowPrimaryAngle
            ? {
                kind: "content_angle",
                id: `${project.id}-angle`,
                title: "当前主打角度",
                summary: truncateText(project.workflowPrimaryAngle),
                score: 72,
                rationale: "主打角度越明确，后续每个平台版本越不容易跑偏。",
                metadata: ["工作流继承角度"],
              }
            : null,
        ]),
      },
      {
        id: "repurpose_route",
        label: "发布路由",
        hits: compactHits([
          suggestedPlatforms.length > 0
            ? {
                kind: "platform_targets",
                id: `${project.id}-platforms`,
                title: "建议优先平台",
                summary: suggestedPlatforms.join(" / "),
                score: 76,
                rationale: "平台优先级已经在上游工作流里给出，不需要每次拆解后重新猜测。",
                metadata: ["平台信号已继承"],
              }
            : null,
          asset?.latestPublishFeedback.trim()
            ? {
                kind: "publish_feedback",
                id: `${project.id}-feedback`,
                title: "最近发布反馈",
                summary: truncateText(asset.latestPublishFeedback),
                score: asset.retryablePlatforms.length > 0 ? 86 : 74,
                rationale: "这决定了当前更值得继续预演、重试，还是直接进入下一轮内容复用。",
                metadata: [asset.publishStatus ? `发布状态 ${asset.publishStatus}` : ""].filter(Boolean),
              }
            : project.workflowNextStep
              ? {
                  kind: "workflow_next_step",
                  id: `${project.id}-next-step`,
                  title: "下一步动作",
                  summary: truncateText(project.workflowNextStep),
                  score: 78,
                  rationale: "内容链最容易断在“内容包做好了但没人接”，显式下一步能减少 handoff 丢失。",
                  metadata: ["等待 Publisher / 预演"],
                }
              : null,
        ]),
      },
    ],
    action,
  );
}

export function buildInboxDeclutterSurfaceRecommendation(input: {
  items: InboxItem[];
  digests?: InboxDigest[];
  digest: string;
  activeItem?: InboxItem | null;
}): RecommendationResult {
  const items = input.items;
  const digests = input.digests ?? [];
  const primaryItem = input.activeItem ?? items[0] ?? null;

  if (items.length === 0) {
    return buildResult(
      "inbox-declutter",
      [],
      {
        kind: "capture_inbox_items",
        label: "先录入需要处理的消息",
        rationale: "当前收件箱还没有待处理条目，先把客户邮件、newsletter 或内部沟通收拢进来，再决定整理策略。",
      },
    );
  }

  const jumpTarget = primaryItem
    ? buildRecordJumpTarget("inbox_declutter", "openclaw:inbox-select", "itemId", primaryItem.id)
    : undefined;
  const digestText = input.digest.trim();
  const clientCount = items.filter((item) => item.source === "client").length;
  const action: RecommendationAction = !digestText
    ? {
        kind: "generate_inbox_digest",
        label: "先生成 Inbox Digest",
        rationale: "当前还没有把最近邮件和消息压成可执行摘要，先做收拢再决定逐条处理更稳。",
      }
    : primaryItem?.source === "client"
      ? {
          kind: "route_client_issue_to_support",
          label: "把客户问题送去 Support Copilot",
          rationale: "Digest 已形成，当前最值得先推进的是客户问题链路，而不是继续让消息停在收件箱里。",
          jumpTarget,
        }
      : {
          kind: "review_digest_and_route",
          label: "按 Digest 处理高优先项",
          rationale: "当前已经有结构化摘要，下一步应根据优先级转邮件、转任务或归档，而不是重新读一遍原始消息。",
          jumpTarget,
        };

  return buildResult(
    primaryItem?.title || "inbox-declutter",
    [
      {
        id: "inbox_overview",
        label: "收件箱信号",
        hits: compactHits([
          primaryItem
            ? {
                kind: "inbox_item",
                id: primaryItem.id,
                title: primaryItem.title || "当前收件箱条目",
                summary: truncateText(primaryItem.body),
                score: primaryItem.source === "client" ? 86 : 74,
                rationale: "这是当前最接近执行动作的一条消息，应先判断它要进入客服、邮件还是归档流程。",
                metadata: [
                  `来源 ${primaryItem.source}`,
                  primaryItem.workflowRunId ? "已绑定 workflow" : "尚未绑定 workflow",
                ],
                jumpTarget,
              }
            : null,
          {
            kind: "inbox_stats",
            id: "inbox-stats",
            title: "当前收件箱总览",
            summary: `共 ${items.length} 条，其中客户消息 ${clientCount} 条，最近 digest ${digests.length} 份。`,
            score: 72,
            rationale: "先看整体负荷，再决定这轮是做清理、分发还是进入客服主线。",
            metadata: ["支持批量整理"],
          },
        ]),
      },
      {
        id: "inbox_digest",
        label: "Digest 状态",
        hits: compactHits([
          digestText
            ? {
                kind: "inbox_digest",
                id: "latest-inbox-digest",
                title: "Digest 已生成",
                summary: truncateText(digestText),
                score: 82,
                rationale: "当前已经有可执行摘要，接下来应按优先级把信息路由出去，而不是继续停留在聚合层。",
                metadata: ["可进入分发阶段"],
              }
            : {
                kind: "inbox_digest_pending",
                id: "inbox-digest-pending",
                title: "尚未生成 Digest",
                summary: "当前还没有把邮件和消息压成统一摘要，容易在逐条阅读里消耗注意力。",
                score: 76,
                rationale: "先生成 Digest，才能更稳定地决定哪些消息值得外联、客服处理或延后。",
                metadata: ["待生成 Digest"],
              },
          primaryItem?.workflowNextStep
            ? {
                kind: "workflow_next_step",
                id: `${primaryItem.id}-next-step`,
                title: "当前下一步",
                summary: truncateText(primaryItem.workflowNextStep),
                score: 78,
                rationale: "这条消息已经被纳入业务链路，不该重新定义动作，而应继续按既有上下文往前推进。",
                metadata: [primaryItem.workflowRunId ? "已接入客服链" : "待进入执行链"],
              }
            : null,
        ]),
      },
    ],
    action,
  );
}

export function buildMorningBriefSurfaceRecommendation(input: {
  focus: string;
  notes: string;
  brief: string;
  taskCount: number;
  draftCount: number;
  latestBriefAt?: number | null;
  currentBrief?: BriefRecord | null;
  workflowSource?: string;
  workflowNextStep?: string;
  asset?: ResearchAssetRecord | null;
}): RecommendationResult {
  const focus = input.focus.trim();
  const brief = input.brief.trim();
  const notes = input.notes.trim();
  const nextActionText = input.asset?.nextAction || input.workflowNextStep || "";
  const action: RecommendationAction = !focus && !brief
    ? {
        kind: "collect_daily_focus",
        label: "先明确今日主线",
        rationale: "当前还没有写清晨报焦点，直接生成晨报只会得到泛化建议，先把最重要产出说清楚。",
      }
    : !brief
      ? {
          kind: "generate_morning_brief",
          label: "先生成晨报",
          rationale: "输入已经足够，下一步应把任务、草稿和研究结论压成一份可执行晨报。",
        }
      : nextActionText
        ? {
            kind: "close_research_loop",
            label: "按晨报完成研究收口",
            rationale: "晨报已经形成，下一步应按既定动作把研究结论落到今天的执行路径，而不是继续堆积分析文本。",
          }
        : {
            kind: "review_daily_brief",
            label: "按晨报推进今日执行",
            rationale: "当前晨报已经具备足够结构，最值得做的是按优先级执行，而不是重新生成另一版。",
          };

  return buildResult(
    focus || "morning-brief",
    [
      {
        id: "morning_focus",
        label: "今日主线",
        hits: compactHits([
          {
            kind: "daily_focus",
            id: "morning-focus",
            title: focus || "尚未填写今日主线",
            summary: truncateText(notes || "当前还没有补充说明。"),
            score: focus ? 82 : 70,
            rationale: "晨报的价值不在于再写一段总结，而在于先把今天真正要推进的主线说清楚。",
            metadata: [focus ? "已有明确焦点" : "待明确焦点"],
          },
          input.currentBrief?.workflowSource
            ? {
                kind: "workflow_source",
                id: "morning-workflow-source",
                title: "上游来源",
                summary: truncateText(input.currentBrief.workflowSource),
                score: 74,
                rationale: "如果晨报来自研究链或别的 workflow，就应该继承原有上下文，而不是重新定义问题。",
                metadata: ["继承工作流上下文"],
              }
            : input.workflowSource
              ? {
                  kind: "workflow_source",
                  id: "morning-workflow-source",
                  title: "上游来源",
                  summary: truncateText(input.workflowSource),
                  score: 74,
                  rationale: "这说明晨报并不是孤立生成，而是某条执行链的收口阶段。",
                  metadata: ["继承工作流上下文"],
                }
              : null,
        ]),
      },
      {
        id: "morning_operating_signals",
        label: "执行信号",
        hits: [
          {
            kind: "operating_signal",
            id: "morning-operating-signal",
            title: "今日执行负荷",
            summary: `任务 ${input.taskCount} 项，最新草稿 ${input.draftCount} 份${input.latestBriefAt ? `，最近晨报 ${new Date(input.latestBriefAt).toLocaleString()}` : ""}。`,
            score: 76,
            rationale: "晨报要解决的是今天先做什么，因此任务和草稿负荷本身就是执行信号的一部分。",
            metadata: ["运行面总览"],
          },
        ],
      },
      {
        id: "morning_output",
        label: "晨报状态",
        hits: compactHits([
          brief
            ? {
                kind: "morning_brief",
                id: "latest-morning-brief",
                title: "晨报已生成",
                summary: truncateText(brief),
                score: 84,
                rationale: "今天的执行摘要已经具备，再往前走应该是执行和复用，而不是继续生成新摘要。",
                metadata: ["可进入执行阶段"],
              }
            : {
                kind: "morning_brief_pending",
                id: "morning-brief-pending",
                title: "尚未生成晨报",
                summary: "当前还没有把任务、草稿和补充说明压成一份统一的今日执行摘要。",
                score: 74,
                rationale: "先形成晨报，今天的优先级和风险提醒才会稳定可见。",
                metadata: ["待生成晨报"],
              },
          nextActionText
            ? {
                kind: "workflow_next_step",
                id: "morning-next-step",
                title: "下一步动作",
                summary: truncateText(nextActionText),
                score: 80,
                rationale: "研究链的最后一跳最容易断在晨报层，显式下一步能防止洞察停留在摘要里。",
                metadata: [input.asset?.status ? `资产状态 ${input.asset.status}` : "待执行收口"],
              }
            : null,
        ]),
      },
    ],
    action,
  );
}

export function buildSupportCopilotSurfaceRecommendation(input: {
  ticket: SupportTicket | null;
  asset?: SupportAssetRecord | null;
}): RecommendationResult {
  const ticket = input.ticket;
  const asset = input.asset ?? null;
  if (!ticket) {
    return buildResult(
      "support-copilot",
      [],
      {
        kind: "select_ticket",
        label: "先选择一条工单",
        rationale: "当前还没有选中的客服上下文，先绑定具体问题，再决定回复、跟进或 FAQ 沉淀。",
      },
    );
  }

  const jumpTarget = buildRecordJumpTarget("support_copilot", "openclaw:support-copilot-select", "ticketId", ticket.id);
  const action: RecommendationAction = !ticket.replyDraft.trim()
    ? {
        kind: "generate_support_reply",
        label: "先生成建议回复",
        rationale: "当前还没有形成可审核回复，客服闭环还停留在原始问题层，先把回复草稿拉出来。",
      }
    : ticket.reviewNotes.trim()
      ? {
          kind: "review_support_reply",
          label: "先处理回复边界",
          rationale: "回复草稿已经生成，但仍有需要人工确认的边界和风险，先收口这些问题再外发。",
          jumpTarget,
        }
      : asset?.faqDraft.trim()
        ? {
            kind: "assetize_support_faq",
            label: "确认 FAQ 资产并入库",
            rationale: "当前工单已经形成可复用 FAQ 草稿，最值得做的是把这次处理沉淀成长期可复用资产。",
          }
        : {
            kind: "queue_support_followup",
            label: "把处理动作转成跟进任务",
            rationale: "回复已经具备发送条件，下一步应明确后续跟进或升级边界，而不是只停在草稿层。",
          };

  return buildResult(
    ticket.subject || ticket.customer || "support-copilot",
    [
      {
        id: "support_ticket",
        label: "工单信号",
        hits: [
          {
            kind: "support_ticket",
            id: ticket.id,
            title: ticket.subject || `${ticket.customer || "客户"} 工单`,
            summary: truncateText(ticket.message || asset?.issueSummary || "当前还没有填写客户问题。"),
            score: ticket.status === "resolved" ? 70 : 84,
            rationale: "这是当前客服闭环需要回应和沉淀的核心问题描述。",
            metadata: [
              ticket.customer ? `客户 ${ticket.customer}` : "",
              ticket.channel ? `渠道 ${ticket.channel}` : "",
              `状态 ${ticket.status}`,
            ].filter(Boolean),
            jumpTarget,
          },
        ],
      },
      {
        id: "support_reply",
        label: "回复信号",
        hits: compactHits([
          ticket.replyDraft.trim()
            ? {
                kind: "support_reply",
                id: `${ticket.id}-reply`,
                title: "回复草稿已生成",
                summary: truncateText(ticket.replyDraft),
                score: 82,
                rationale: "AI 起草已经完成，接下来最重要的是人工审核边界，而不是重新收集问题。",
                metadata: ["可进入人审"],
                jumpTarget,
              }
            : {
                kind: "support_reply_pending",
                id: `${ticket.id}-reply-pending`,
                title: "尚未生成回复草稿",
                summary: "当前还没有形成可审核回复，客服动作容易停留在原始消息阅读阶段。",
                score: 76,
                rationale: "先把建议回复写出来，后续跟进、升级和 FAQ 沉淀才有共同基础。",
                metadata: ["待生成回复"],
                jumpTarget,
              },
          ticket.reviewNotes.trim()
            ? {
                kind: "support_review",
                id: `${ticket.id}-review`,
                title: "存在人工审核边界",
                summary: truncateText(ticket.reviewNotes),
                score: 88,
                rationale: "这里集中描述了当前回复里最可能出错的承诺、时效或结论边界。",
                metadata: ["待人工确认"],
                jumpTarget,
              }
            : null,
        ]),
      },
      {
        id: "support_assetize",
        label: "跟进与沉淀",
        hits: compactHits([
          asset?.escalationTask.trim()
            ? {
                kind: "support_followup",
                id: `${ticket.id}-followup`,
                title: "已形成后续跟进动作",
                summary: truncateText(asset.escalationTask),
                score: 74,
                rationale: "这说明当前工单已经从回复阶段进入执行阶段，应继续明确谁来跟、跟什么。",
                metadata: [asset.status ? `资产状态 ${asset.status}` : "待跟进"],
              }
            : null,
          asset?.faqDraft.trim()
            ? {
                kind: "support_faq",
                id: `${ticket.id}-faq`,
                title: "FAQ / 升级边界草稿",
                summary: truncateText(asset.faqDraft),
                score: 86,
                rationale: "这是当前最接近复用价值的支持资产，不该继续只停在工单上下文里。",
                metadata: ["可沉淀知识资产"],
                jumpTarget,
              }
            : {
                kind: "support_asset_gap",
                id: `${ticket.id}-faq-gap`,
                title: "尚未沉淀 FAQ 资产",
                summary: truncateText(asset?.nextAction || ticket.workflowNextStep || "当前还没有把这次处理沉淀成 FAQ 或升级规则。"),
                score: 72,
                rationale: "如果这一轮处理结束后没有沉淀标准回复和边界，类似问题还会重复人工处理。",
                metadata: ["待沉淀资产"],
              },
        ]),
      },
    ],
    action,
  );
}

export function buildDeepResearchSurfaceRecommendation(input: {
  report: ResearchReportRecord | null;
  asset?: ResearchAssetRecord | null;
}): RecommendationResult {
  const report = input.report;
  const asset = input.asset ?? null;
  if (!report) {
    return buildResult(
      "deep-research-hub",
      [],
      {
        kind: "select_research_item",
        label: "先选择一条研究任务",
        rationale: "当前还没有选中的研究上下文，先确定主题、来源和角度，再判断该先生成简报还是进入分发。",
      },
    );
  }

  const jumpTarget = buildRecordJumpTarget("deep_research_hub", "openclaw:research-hub-select", "reportId", report.id);
  const missingInputs = [
    !report.topic.trim() ? "研究主题" : "",
    !report.sources.trim() ? "来源范围" : "",
    !report.angle.trim() ? "研究角度" : "",
    !report.audience.trim() ? "输出对象" : "",
  ].filter(Boolean);

  const nextActionText = asset?.nextAction || report.workflowNextStep || "";
  const prefersBrief = /Morning Brief/i.test(nextActionText);
  const action: RecommendationAction = !report.report.trim()
    ? missingInputs.length >= 2
      ? {
          kind: "collect_research_scope",
          label: "先补研究范围",
          rationale: "主题、来源和角度信息还不够完整，直接生成研究简报会让结论过于松散。",
          jumpTarget,
        }
      : {
          kind: "generate_research_brief",
          label: "先生成研究简报",
          rationale: "研究输入已经足够支撑第一轮综合判断，先把关键发现、对比和下一步压成可复用简报。",
        }
    : prefersBrief
      ? {
          kind: "route_research_to_brief",
          label: "送入 Morning Brief",
          rationale: "当前最需要的是把研究结论压成今天可执行的判断和动作，而不是继续停留在 research hub 里。",
        }
      : {
          kind: "route_research_to_vault",
          label: "送入 Knowledge Vault",
          rationale: "研究简报已经形成，下一步应把长期有效的观察维度、资料框架和后续问题沉淀进知识层。",
        };

  return buildResult(
    report.topic || "deep-research-hub",
    [
      {
        id: "research_scope",
        label: "研究输入",
        hits: [
          {
            kind: "research_scope",
            id: report.id,
            title: report.topic || "当前研究任务",
            summary: truncateText(
              report.notes || `来源：${report.sources || "未填"}；角度：${report.angle || "未填"}；对象：${report.audience || "未填"}`,
            ),
            score: missingInputs.length === 0 ? 80 : 72,
            rationale: "研究是否有价值，先取决于主题、来源和判断角度是否足够清楚。",
            metadata: [
              report.sources ? "已定义来源范围" : "",
              report.angle ? "已定义研究角度" : "",
              report.audience ? `对象 ${report.audience}` : "",
            ].filter(Boolean),
            jumpTarget,
          },
          ...(missingInputs.length > 0
            ? missingInputs.slice(0, 3).map((field, index) => ({
                kind: "missing_research_context",
                id: `${report.id}-missing-${field}-${index}`,
                title: `补齐${field}`,
                summary: `当前研究任务还缺少 ${field}，会让生成结果更像资料堆砌而不是可执行判断。`,
                score: 84 - index * 4,
                rationale: "研究类输出的质量高度依赖输入边界，这些字段越空，后续越难形成稳定结论。",
                metadata: ["研究范围待补齐"],
                jumpTarget,
              }))
            : []),
        ],
      },
      {
        id: "research_output",
        label: "研究输出",
        hits: compactHits([
          report.report.trim()
            ? {
                kind: "research_report",
                id: `${report.id}-report`,
                title: "研究简报已生成",
                summary: truncateText(report.report),
                score: 84,
                rationale: "当前已经有结构化研究产物，下一步不该重复生成，而应尽快进入分发和沉淀。",
                metadata: ["可进入路由阶段"],
                jumpTarget,
              }
            : {
                kind: "research_report_pending",
                id: `${report.id}-report-pending`,
                title: "尚未形成研究简报",
                summary: "当前还没有把研究主题、来源和判断压成结构化输出。",
                score: 74,
                rationale: "先形成简报，后续送知识库、送晨报和形成任务指令才有共同输入。",
                metadata: ["待生成研究简报"],
                jumpTarget,
              },
        ]),
      },
      {
        id: "research_route",
        label: "沉淀与分发",
        hits: compactHits([
          asset?.vaultQuery.trim()
            ? {
                kind: "research_vault_route",
                id: `${report.id}-vault-route`,
                title: "已准备送入 Knowledge Vault",
                summary: truncateText(asset.vaultQuery),
                score: 78,
                rationale: "研究结果已经具备长期沉淀入口，下一步应把它变成后续可检索、可复用的资产。",
                metadata: ["知识沉淀入口已准备"],
              }
            : null,
          nextActionText
            ? {
                kind: "research_next_step",
                id: `${report.id}-next-step`,
                title: "下一步动作",
                summary: truncateText(nextActionText),
                score: 80,
                rationale: "研究闭环最容易断在“有结论但没人接”，显式下一步能避免结果只停留在当前页面。",
                metadata: [asset?.status ? `资产状态 ${asset.status}` : "等待路由"],
              }
            : null,
        ]),
      },
    ],
    action,
  );
}

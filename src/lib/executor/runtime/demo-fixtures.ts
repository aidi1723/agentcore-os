export const DEMO_PLAYBOOK_IDS = ["sales-pipeline-v1", "support-resolution-v1"] as const;

export type DemoPlaybookId = (typeof DEMO_PLAYBOOK_IDS)[number];

export type DemoFixture = {
  playbookId: DemoPlaybookId;
  userMessage: string;
  stepOutputs: Record<string, Record<string, unknown>>;
};

const salesFixture: DemoFixture = {
  playbookId: "sales-pipeline-v1",
  userMessage: "Example Co / Demo Contact / web_form / demo。需求：演示一条受控销售跟进。预算和时间留空。",
  stepOutputs: {
    intake: {
      summary: "Demo inquiry from Example Co",
      missingFields: ["budget", "timing"],
      normalizedLead: {
        company: "Example Co",
        contact: "Demo Contact",
        inquiryChannel: "web_form",
        preferredLanguage: "zh",
        productLine: "demo",
        need: "演示一条受控销售跟进",
      },
    },
    qualify: {
      priority: "medium",
      reasons: ["演示夹具，预算和时间留空"],
      risks: ["预算未填写"],
      nextAction: "起草待复核跟进",
    },
    draft_outreach: {
      subject: "Example Co 演示跟进",
      body: "这是待复核草稿，尚未批准，也不会写成销售终稿。",
      assumptions: ["预算未知"],
      needsHumanCheck: ["budget"],
    },
    human_review: {
      approved: true,
      approvedBody: "Example Co 演示跟进已批准。预算仍未知，不承诺价格。",
      reviewNotes: "演示夹具：人工批准",
    },
    writeback: {
      salesAssetUpdated: true,
      knowledgeAssetCandidate: "Example Co 演示跟进已批准。预算仍未知，不承诺价格。",
    },
  },
};

const supportFixture: DemoFixture = {
  playbookId: "support-resolution-v1",
  userMessage: "演示工单：登录失败",
  stepOutputs: {
    intake: {
      summary: "演示工单：登录失败",
      missingFields: [],
      normalizedIssue: {
        customer: "Demo Contact",
        channel: "web_form",
        subject: "登录失败",
        issue: "演示工单：登录失败",
        productLine: "demo",
        language: "zh",
      },
    },
    classify: {
      category: "login_failure",
      priority: "high",
      risks: ["无法确认账号"],
      missingInfo: [],
      nextAction: "起草待复核回复",
    },
    draft_reply: {
      subject: "登录失败演示回复",
      body: "这是待复核回复，尚未批准。",
      tone: "calm",
      assumptions: [],
      needsHumanCheck: ["账号"],
    },
    human_review: {
      approved: true,
      approvedReply: "请再试一次登录。这是演示批准稿，不承诺赔偿。",
      reviewNotes: "演示夹具：人工批准",
      nextAction: "等待用户确认账号",
    },
    writeback: {
      supportAssetUpdated: true,
      knowledgeAssetCandidate: "登录失败时先确认账号，再建议重试。",
      faqCandidate: "登录失败时先确认账号，不在未批准时承诺赔偿。",
    },
  },
};

const fixtures: Record<DemoPlaybookId, DemoFixture> = {
  "sales-pipeline-v1": salesFixture,
  "support-resolution-v1": supportFixture,
};

export function isDemoPlaybookId(value: string): value is DemoPlaybookId {
  return (DEMO_PLAYBOOK_IDS as readonly string[]).includes(value);
}

export function getDemoFixture(playbookId: DemoPlaybookId): DemoFixture {
  return fixtures[playbookId];
}

export function getDemoStepOutput(playbookId: string | undefined, stepId: string) {
  if (!playbookId || !isDemoPlaybookId(playbookId)) return null;
  return fixtures[playbookId].stepOutputs[stepId] ?? null;
}

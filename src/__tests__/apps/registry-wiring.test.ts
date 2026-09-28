import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(path.join(process.cwd(), "src/apps/registry.ts"), "utf8");

const designSystemWindows = [
  "RecruitingDeskAppWindow",
  "ProjectOpsAppWindow",
  "DeepResearchHubAppWindow",
  "FinancialDocumentBotAppWindow",
  "SocialMediaAutopilotAppWindow",
  "WebsiteSeoStudioAppWindow",
  "LanguageLearningDeskAppWindow",
  "TechNewsDigestAppWindow",
  "MorningBriefAppWindow",
  "MeetingCopilotAppWindow",
  "PersonalCRMAppWindow",
  "InboxDeclutterAppWindow",
  "SupportCopilotAppWindow",
  "SecondBrainAppWindow",
  "EmailAssistantAppWindow",
  "FamilyCalendarAppWindow",
  "HabitTrackerAppWindow",
  "HealthTrackerAppWindow",
  "CreatorRadarAppWindow",
  "ContentRepurposerAppWindow",
  "MediaOpsAppWindow",
  "CreativeStudioAppWindow",
  "AccountCenterAppWindow",
  "TaskManagerAppWindow",
  "SoloOpsAppWindow",
  "SolutionsHubAppWindow",
];

const fullImplementationWindows = [
  "ClawRuntimeConsoleAppWindow",
  "PublisherAppWindow",
  "SettingsAppWindow",
  "IndustryHubAppWindow",
  "KnowledgeVaultAppWindow",
  "DealDeskAppWindow",
];

describe("app registry wiring", () => {
  it("loads design-system windows from the v2 modules", () => {
    for (const name of designSystemWindows) {
      expect(source).toContain(`@/components/apps/${name}.v2`);
    }
    expect(designSystemWindows).toHaveLength(26);
  });

  it("keeps the full settings, publisher, and runtime console implementations", () => {
    for (const name of fullImplementationWindows) {
      expect(source).toContain(`@/components/apps/${name}"`);
      expect(source).not.toContain(`@/components/apps/${name}.v2`);
    }
  });
});

import salesPipelineFixture from "@/__tests__/fixtures/controlled-traces/sales-pipeline-governed.fixture.json";
import supportResolutionFixture from "@/__tests__/fixtures/controlled-traces/support-resolution-governed.fixture.json";
import type { ControlledTraceFixture } from "@/lib/executor/runtime/trace-fixtures";

export type ControlledTraceFixtureCatalogEntry = {
  id: string;
  playbookId: string;
  fixture: ControlledTraceFixture;
};

export const controlledTraceFixtureCatalog: ControlledTraceFixtureCatalogEntry[] = [
  {
    id: "sales-pipeline-governed",
    playbookId: "sales-pipeline-v1",
    fixture: salesPipelineFixture as ControlledTraceFixture,
  },
  {
    id: "support-resolution-governed",
    playbookId: "support-resolution-v1",
    fixture: supportResolutionFixture as ControlledTraceFixture,
  },
];

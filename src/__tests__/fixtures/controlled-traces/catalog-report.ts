import {
  controlledTraceFixtureCatalog,
  type ControlledTraceFixtureCatalogEntry,
} from "@/__tests__/fixtures/controlled-traces/catalog";
import {
  validateControlledTraceFixture,
  type ControlledTraceFixtureValidationResult,
} from "@/lib/executor/runtime/trace-fixtures";
import {
  replayControlledTraceFixture,
  type ControlledTraceReplayReport,
} from "@/lib/executor/runtime/trace-replay";

export type ControlledTraceFixtureCatalogReportItem = {
  catalogId: string;
  fixtureId: string;
  playbookId: string;
  ok: boolean;
  validation: ControlledTraceFixtureValidationResult;
  replay: ControlledTraceReplayReport;
};

export type ControlledTraceFixtureCatalogReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  fixtureIds: string[];
  playbookIds: string[];
  items: ControlledTraceFixtureCatalogReportItem[];
  guarantees: {
    toolCallsExecuted: false;
    assetsWritten: false;
  };
};

export function buildControlledTraceFixtureCatalogReport(
  entries: ControlledTraceFixtureCatalogEntry[] = controlledTraceFixtureCatalog,
): ControlledTraceFixtureCatalogReport {
  const items = entries.map((entry) => {
    const validation = validateControlledTraceFixture(entry.fixture);
    const replay = replayControlledTraceFixture(entry.fixture);

    return {
      catalogId: entry.id,
      fixtureId: entry.fixture.fixtureId,
      playbookId: entry.playbookId,
      ok: validation.ok && replay.ok,
      validation,
      replay,
    };
  });

  const passed = items.filter((item) => item.ok).length;
  const failed = items.length - passed;

  return {
    ok: failed === 0,
    total: entries.length,
    passed,
    failed,
    fixtureIds: entries.map((entry) => entry.id),
    playbookIds: entries.map((entry) => entry.playbookId),
    items,
    guarantees: {
      toolCallsExecuted: false,
      assetsWritten: false,
    },
  };
}

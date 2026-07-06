import { salesPipelinePlaybook } from "@/lib/executor/playbooks/sales-pipeline";
import { supportResolutionPlaybook } from "@/lib/executor/playbooks/support-resolution";
import type { ControlledPlaybook } from "@/lib/executor/playbooks/types";

const controlledPlaybooks: ControlledPlaybook[] = [
  salesPipelinePlaybook,
  supportResolutionPlaybook,
];

export function listControlledPlaybooks() {
  return controlledPlaybooks;
}

export function getControlledPlaybook(playbookId: string) {
  return controlledPlaybooks.find((playbook) => playbook.id === playbookId) ?? null;
}

export function getControlledPlaybookForScenario(scenarioId: string) {
  return controlledPlaybooks.find((playbook) => playbook.scenarioId === scenarioId) ?? null;
}

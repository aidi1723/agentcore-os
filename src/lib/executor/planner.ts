import type {
  AgentCoreTaskRequest,
  ExecutionPlan,
  ExecutionStep,
  ToolCallSpec,
} from "@/lib/executor/contracts";
import { listToolNames } from "@/lib/executor/tools";

export type PlannerContext = {
  availableTools: string[];
  maxSteps: number;
};

function buildExecutionId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const PLANNER_SYSTEM_PROMPT = `You are a task planner for AgentCore OS. Given a user goal, decompose it into concrete executable steps.

Rules:
- Each step must be a single, atomic action
- Steps should be ordered by dependency (earlier steps first)
- Mark steps that modify data or execute code as "review" mode
- Mark information-gathering steps as "auto" mode
- Mark steps that need human decision as "manual" mode
- Each step should specify which tools it needs
- Keep the total number of steps minimal (prefer fewer, well-scoped steps)
- Maximum {MAX_STEPS} steps allowed

Available tools: {TOOLS}

Respond with a JSON array of steps. Each step has:
- id: unique string (step_1, step_2, ...)
- title: short action title
- description: what this step does
- toolCalls: array of { toolName, description, params } for tools needed
- dependsOn: array of step ids that must complete first
- mode: "auto" | "assist" | "review" | "manual"

Respond ONLY with the JSON array, no other text.`;

function buildPlannerPrompt(goal: string, context: PlannerContext): string {
  return PLANNER_SYSTEM_PROMPT
    .replace("{MAX_STEPS}", String(context.maxSteps))
    .replace("{TOOLS}", context.availableTools.join(", "));
}

type RawStep = {
  id?: string;
  title?: string;
  description?: string;
  toolCalls?: Array<{ toolName?: string; description?: string; params?: unknown }>;
  dependsOn?: string[];
  mode?: string;
};

function parseStepsFromLlmOutput(text: string, maxSteps: number): ExecutionStep[] {
  const trimmed = text.trim();
  // Try to extract JSON array from the response
  const jsonMatch = trimmed.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]) as RawStep[];
    if (!Array.isArray(parsed)) return [];

    return parsed.slice(0, maxSteps).map((raw, i): ExecutionStep => ({
      id: typeof raw.id === "string" ? raw.id : `step_${i + 1}`,
      title: typeof raw.title === "string" ? raw.title : `Step ${i + 1}`,
      description: typeof raw.description === "string" ? raw.description : "",
      toolCalls: Array.isArray(raw.toolCalls)
        ? raw.toolCalls
            .filter((tc): tc is { toolName: string; description?: string; params?: unknown } =>
              typeof tc?.toolName === "string")
            .map((tc): ToolCallSpec => ({
              toolName: tc.toolName,
              description: tc.description,
              params:
                tc.params && typeof tc.params === "object" && !Array.isArray(tc.params)
                  ? (tc.params as Record<string, unknown>)
                  : undefined,
            }))
        : [],
      dependsOn: Array.isArray(raw.dependsOn)
        ? raw.dependsOn.filter((d): d is string => typeof d === "string")
        : [],
      mode: raw.mode === "auto" || raw.mode === "assist" || raw.mode === "review" || raw.mode === "manual"
        ? raw.mode
        : "auto",
    }));
  } catch {
    return [];
  }
}

export async function planSteps(
  request: AgentCoreTaskRequest,
  callLlm: (systemPrompt: string, userMessage: string) => Promise<string>,
): Promise<ExecutionPlan> {
  const maxSteps = request.multiStep?.maxSteps ?? 10;
  const context: PlannerContext = {
    availableTools: listToolNames(),
    maxSteps,
  };

  const systemPrompt = buildPlannerPrompt(request.taskInput.userMessage, context);
  const userMessage = `Goal: ${request.taskInput.userMessage}`;

  let llmOutput = await callLlm(systemPrompt, userMessage);
  let steps = parseStepsFromLlmOutput(llmOutput, maxSteps);

  // Retry once if parsing failed
  if (steps.length === 0) {
    llmOutput = await callLlm(
      systemPrompt,
      `${userMessage}\n\nIMPORTANT: Respond ONLY with a valid JSON array. No markdown, no explanation.`,
    );
    steps = parseStepsFromLlmOutput(llmOutput, maxSteps);
  }

  const hasApprovalSteps = steps.some(
    (s) => s.mode === "review" || s.mode === "manual",
  );

  return {
    id: buildExecutionId("plan"),
    goal: request.taskInput.userMessage,
    steps,
    totalSteps: steps.length,
    requiresApproval: hasApprovalSteps,
  };
}

/**
 * Build a simple single-step plan for cases where decomposition isn't needed.
 */
export function buildSingleStepPlan(
  goal: string,
  toolCalls: ToolCallSpec[] = [],
): ExecutionPlan {
  return {
    id: buildExecutionId("plan"),
    goal,
    steps: [
      {
        id: "step_1",
        title: "Execute task",
        description: goal,
        toolCalls,
        dependsOn: [],
        mode: "auto",
      },
    ],
    totalSteps: 1,
    requiresApproval: false,
  };
}

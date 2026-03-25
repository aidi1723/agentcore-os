import path from "path";
import { OPENCLAW_HOME, OPENCLAW_WORKSPACE } from "./config.ts";

export { OPENCLAW_HOME, OPENCLAW_WORKSPACE };

export const TASKBOARD_DIR = path.join(OPENCLAW_WORKSPACE, "taskboard");
export const TASKBOARD_LOG = path.join(TASKBOARD_DIR, "time_log.jsonl");
export const TASKBOARD_TASKS = path.join(TASKBOARD_DIR, "tasks.json");

export const SKILLS_DIR = path.join(OPENCLAW_WORKSPACE, "skills");

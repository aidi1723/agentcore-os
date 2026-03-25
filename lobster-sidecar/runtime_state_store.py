from __future__ import annotations

import time
import uuid
from typing import Any

from storage import read_json, write_json


MAX_EXECUTOR_SESSIONS = 120
MAX_EXECUTOR_TURNS = 80
MAX_DEALS = 240
MAX_SUPPORT_TICKETS = 320
MAX_WORKFLOW_RUNS = 160
DEAL_STAGES = {"new", "qualified", "proposal", "blocked", "won"}
SUPPORT_CHANNELS = {"email", "whatsapp", "instagram", "reviews"}
SUPPORT_STATUSES = {"new", "waiting", "resolved"}
WORKFLOW_RUN_STATES = {"idle", "running", "awaiting_human", "completed", "error"}
WORKFLOW_STAGE_STATES = {"pending", "running", "awaiting_human", "completed", "error"}
WORKFLOW_TRIGGER_TYPES = {"manual", "schedule", "inbound_message", "web_form"}


def _now_ms() -> int:
    return int(time.time() * 1000)


def _clip_text(value: Any, limit: int) -> str:
    trimmed = str(value or "").strip()
    if len(trimmed) <= limit:
        return trimmed
    return f"{trimmed[: max(1, limit - 1)]}…"


def _normalize_timestamp(value: Any, fallback: int | None = None) -> int:
    if isinstance(value, (int, float)) and value == value:
        return int(value)
    return _now_ms() if fallback is None else fallback


def _sanitize_workspace_context(
    input_value: dict[str, Any] | None,
) -> dict[str, str | int | bool]:
    if not isinstance(input_value, dict):
        return {}

    result: dict[str, str | int | bool] = {}
    for key, value in input_value.items():
        if isinstance(value, str):
            trimmed = value.strip()
            if trimmed:
                result[key] = _clip_text(trimmed, 240)
        elif isinstance(value, bool):
            result[key] = value
        elif isinstance(value, (int, float)) and value == value:
            result[key] = int(value) if int(value) == value else value
    return result


def _executor_sessions_path() -> str:
    return "executor-sessions.json"


def _normalize_executor_turn(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None

    created_at = _normalize_timestamp(input_value.get("createdAt"))
    output_text = input_value.get("outputText")
    error = input_value.get("error")

    return {
        "id": _clip_text(input_value.get("id") or "", 120) or f"{created_at}-{uuid.uuid4().hex[:8]}",
        "createdAt": created_at,
        "durationMs": max(0, int(input_value.get("durationMs") or 0)),
        "source": _clip_text(input_value.get("source") or "agentcore", 120) or "agentcore",
        "engine": _clip_text(input_value.get("engine") or "unknown", 120) or "unknown",
        "ok": bool(input_value.get("ok")),
        "message": _clip_text(input_value.get("message") or "", 12_000),
        "systemPrompt": _clip_text(input_value.get("systemPrompt") or "", 12_000),
        "useSkills": bool(input_value.get("useSkills")),
        "workspaceContext": _sanitize_workspace_context(input_value.get("workspaceContext")),
        "llmProvider": _clip_text(input_value.get("llmProvider") or "", 120),
        "llmModel": _clip_text(input_value.get("llmModel") or "", 240),
        "timeoutSeconds": max(0, int(input_value.get("timeoutSeconds") or 0)),
        "outputText": _clip_text(output_text, 20_000) if isinstance(output_text, str) and output_text.strip() else None,
        "error": _clip_text(error, 4_000) if isinstance(error, str) and error.strip() else None,
    }


def _normalize_executor_session(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None
    session_id = str(input_value.get("id") or "").strip()
    if not session_id:
        return None

    raw_turns = input_value.get("turns")
    turns = []
    if isinstance(raw_turns, list):
        for item in raw_turns:
            turn = _normalize_executor_turn(item)
            if turn is not None:
                turns.append(turn)
    turns = turns[-MAX_EXECUTOR_TURNS:]
    last_turn = turns[-1] if turns else None
    first_turn = turns[0] if turns else None

    return {
        "id": session_id,
        "title": (
            _clip_text(input_value.get("title") or "", 120)
            or _clip_text((first_turn or {}).get("message") or "新会话", 120)
            or "新会话"
        ),
        "updatedAt": _normalize_timestamp(
            input_value.get("updatedAt"),
            last_turn["createdAt"] if last_turn else _now_ms(),
        ),
        "lastEngine": _clip_text(input_value.get("lastEngine") or (last_turn or {}).get("engine") or "unknown", 120)
        or "unknown",
        "lastStatus": "error" if input_value.get("lastStatus") == "error" else "ok",
        "lastMessage": _clip_text(
            input_value.get("lastMessage") or (last_turn or {}).get("message") or "",
            240,
        ),
        "lastOutputPreview": _clip_text(
            input_value.get("lastOutputPreview")
            or (last_turn or {}).get("outputText")
            or (last_turn or {}).get("error")
            or "",
            240,
        ),
        "turns": turns,
    }


def _read_all_executor_sessions() -> list[dict[str, Any]]:
    raw = read_json(_executor_sessions_path(), [])
    sessions: list[dict[str, Any]] = []
    if isinstance(raw, list):
        for item in raw:
            session = _normalize_executor_session(item)
            if session is not None:
                sessions.append(session)
    sessions.sort(key=lambda item: int(item.get("updatedAt") or 0), reverse=True)
    return sessions[:MAX_EXECUTOR_SESSIONS]


def list_executor_sessions() -> list[dict[str, Any]]:
    return _read_all_executor_sessions()


def get_executor_session(session_id: str) -> dict[str, Any] | None:
    normalized_id = session_id.strip()
    if not normalized_id:
        return None
    return next(
        (session for session in _read_all_executor_sessions() if session.get("id") == normalized_id),
        None,
    )


def append_executor_session_turn(input_value: dict[str, Any]) -> dict[str, Any] | None:
    session_id = str(input_value.get("sessionId") or "").strip()
    if not session_id:
        return None

    created_at = _normalize_timestamp(input_value.get("createdAt"))
    turn = _normalize_executor_turn(
        {
            "id": f"{created_at}-{uuid.uuid4().hex[:8]}",
            "createdAt": created_at,
            "durationMs": input_value.get("durationMs") or 0,
            "source": input_value.get("source") or "agentcore",
            "engine": input_value.get("engine") or "unknown",
            "ok": bool(input_value.get("ok")),
            "message": input_value.get("message") or "",
            "systemPrompt": input_value.get("systemPrompt") or "",
            "useSkills": bool(input_value.get("useSkills")),
            "workspaceContext": input_value.get("workspaceContext") or {},
            "llmProvider": input_value.get("llmProvider") or "",
            "llmModel": input_value.get("llmModel") or "",
            "timeoutSeconds": input_value.get("timeoutSeconds") or 0,
            "outputText": input_value.get("outputText"),
            "error": input_value.get("error"),
        }
    )
    if turn is None:
        return None

    sessions = _read_all_executor_sessions()
    existing = next((session for session in sessions if session.get("id") == session_id), None)
    next_turns = [*(existing.get("turns") if isinstance(existing, dict) else []), turn][-MAX_EXECUTOR_TURNS:]
    next_record = {
        "id": session_id,
        "title": (
            existing.get("title")
            if isinstance(existing, dict) and str(existing.get("title") or "").strip() and existing.get("title") != "新会话"
            else _clip_text(turn.get("message") or "", 120) or "新会话"
        ),
        "updatedAt": turn["createdAt"],
        "lastEngine": turn["engine"],
        "lastStatus": "ok" if turn["ok"] else "error",
        "lastMessage": _clip_text(turn.get("message") or "", 240),
        "lastOutputPreview": _clip_text(turn.get("outputText") or turn.get("error") or "", 240),
        "turns": next_turns,
    }
    next_sessions = [next_record, *[session for session in sessions if session.get("id") != session_id]]
    next_sessions.sort(key=lambda item: int(item.get("updatedAt") or 0), reverse=True)
    write_json(_executor_sessions_path(), next_sessions[:MAX_EXECUTOR_SESSIONS])
    return next_record


def _pick_string(input_value: dict[str, Any], key: str, fallback: str = "") -> str:
    value = input_value.get(key)
    return value if isinstance(value, str) else fallback


def _normalize_deal(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None
    deal_id = str(input_value.get("id") or "").strip()
    if not deal_id:
        return None
    created_at = _normalize_timestamp(input_value.get("createdAt"))
    updated_at = _normalize_timestamp(input_value.get("updatedAt"), created_at)
    stage = str(input_value.get("stage") or "").strip()
    return {
        "id": deal_id,
        "company": _pick_string(input_value, "company", "新线索"),
        "contact": _pick_string(input_value, "contact"),
        "inquiryChannel": _pick_string(input_value, "inquiryChannel"),
        "preferredLanguage": _pick_string(input_value, "preferredLanguage"),
        "productLine": _pick_string(input_value, "productLine"),
        "need": _pick_string(input_value, "need"),
        "budget": _pick_string(input_value, "budget"),
        "timing": _pick_string(input_value, "timing"),
        "stage": stage if stage in DEAL_STAGES else "new",
        "notes": _pick_string(input_value, "notes"),
        "brief": _pick_string(input_value, "brief"),
        "reviewNotes": _pick_string(input_value, "reviewNotes"),
        "workflowRunId": _pick_string(input_value, "workflowRunId") or None,
        "workflowScenarioId": _pick_string(input_value, "workflowScenarioId") or None,
        "workflowStageId": _pick_string(input_value, "workflowStageId") or None,
        "workflowSource": _pick_string(input_value, "workflowSource") or None,
        "workflowNextStep": _pick_string(input_value, "workflowNextStep") or None,
        "workflowTriggerType": (
            input_value.get("workflowTriggerType")
            if input_value.get("workflowTriggerType") in WORKFLOW_TRIGGER_TYPES
            else None
        ),
        "createdAt": created_at,
        "updatedAt": updated_at,
    }


def _normalize_basic_tombstone(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None
    item_id = str(input_value.get("id") or "").strip()
    deleted_at = input_value.get("deletedAt")
    if not item_id or not isinstance(deleted_at, (int, float)) or deleted_at != deleted_at:
        return None
    updated_at = _normalize_timestamp(input_value.get("updatedAt"), int(deleted_at))
    return {
        "id": item_id,
        "updatedAt": updated_at,
        "deletedAt": int(deleted_at),
    }


def _is_tombstone(entry: dict[str, Any]) -> bool:
    return "deletedAt" in entry


def _normalize_deal_entry(input_value: Any) -> dict[str, Any] | None:
    return _normalize_basic_tombstone(input_value) or _normalize_deal(input_value)


def _normalize_deal_entries(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    deduped: dict[str, dict[str, Any]] = {}
    for item in raw:
        entry = _normalize_deal_entry(item)
        if entry is None:
            continue
        existing = deduped.get(entry["id"])
        if existing is None or int(existing["updatedAt"]) < int(entry["updatedAt"]):
            deduped[entry["id"]] = entry
        elif (
            int(existing["updatedAt"]) == int(entry["updatedAt"])
            and not _is_tombstone(existing)
            and _is_tombstone(entry)
        ):
            deduped[entry["id"]] = entry
    return sorted(deduped.values(), key=lambda item: int(item["updatedAt"]), reverse=True)[:MAX_DEALS]


def _live_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [entry for entry in entries if not _is_tombstone(entry)]


def _tombstone_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [entry for entry in entries if _is_tombstone(entry)]


def list_deal_store_snapshot() -> dict[str, list[dict[str, Any]]]:
    entries = _normalize_deal_entries(read_json("deals.json", []))
    return {
        "deals": _live_entries(entries),
        "tombstones": _tombstone_entries(entries),
    }


def write_deals_to_store(input_value: Any) -> list[dict[str, Any]]:
    normalized = _live_entries(_normalize_deal_entries(input_value))
    write_json("deals.json", normalized)
    return normalized


def upsert_deal_in_store(input_value: Any) -> dict[str, Any]:
    candidate = _normalize_deal(input_value)
    if candidate is None:
        return {"deal": None, "tombstone": None, "accepted": False}

    entries = _normalize_deal_entries(read_json("deals.json", []))
    existing = next((entry for entry in entries if entry["id"] == candidate["id"]), None)
    if existing and (
        int(existing["updatedAt"]) > int(candidate["updatedAt"])
        or (int(existing["updatedAt"]) == int(candidate["updatedAt"]) and _is_tombstone(existing))
    ):
        return {
            "deal": None if _is_tombstone(existing) else existing,
            "tombstone": existing if _is_tombstone(existing) else None,
            "accepted": False,
        }

    next_entries = [candidate, *[entry for entry in entries if entry["id"] != candidate["id"]]]
    next_entries = sorted(next_entries, key=lambda item: int(item["updatedAt"]), reverse=True)[:MAX_DEALS]
    write_json("deals.json", next_entries)
    stored = next((entry for entry in next_entries if entry["id"] == candidate["id"] and not _is_tombstone(entry)), candidate)
    return {"deal": stored, "tombstone": None, "accepted": True}


def remove_deal_from_store(deal_id: str, updated_at: int | float | None = None) -> dict[str, Any]:
    normalized_id = deal_id.strip()
    if not normalized_id:
        return {"removed": False, "conflict": False, "deal": None, "tombstone": None}

    entries = _normalize_deal_entries(read_json("deals.json", []))
    existing = next((entry for entry in entries if entry["id"] == normalized_id), None)
    if existing is None:
        deleted_at = _now_ms()
        tombstone = {"id": normalized_id, "updatedAt": deleted_at, "deletedAt": deleted_at}
        write_json("deals.json", [tombstone, *entries][:MAX_DEALS])
        return {"removed": True, "conflict": False, "deal": None, "tombstone": tombstone}

    if _is_tombstone(existing):
        conflict = isinstance(updated_at, (int, float)) and int(existing["updatedAt"]) > int(updated_at)
        return {"removed": False, "conflict": conflict, "deal": None, "tombstone": existing}

    if isinstance(updated_at, (int, float)) and int(existing["updatedAt"]) > int(updated_at):
        return {"removed": False, "conflict": True, "deal": existing, "tombstone": None}

    deleted_at = _now_ms()
    tombstone = {"id": normalized_id, "updatedAt": deleted_at, "deletedAt": deleted_at}
    next_entries = [tombstone, *[entry for entry in entries if entry["id"] != normalized_id]][:MAX_DEALS]
    write_json("deals.json", next_entries)
    return {"removed": True, "conflict": False, "deal": existing, "tombstone": tombstone}


def _normalize_support_ticket(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None
    ticket_id = str(input_value.get("id") or "").strip()
    if not ticket_id:
        return None
    created_at = _normalize_timestamp(input_value.get("createdAt"))
    updated_at = _normalize_timestamp(input_value.get("updatedAt"), created_at)
    channel = str(input_value.get("channel") or "").strip()
    status = str(input_value.get("status") or "").strip()
    return {
        "id": ticket_id,
        "customer": _pick_string(input_value, "customer", "新客户"),
        "channel": channel if channel in SUPPORT_CHANNELS else "email",
        "subject": _pick_string(input_value, "subject", "未命名工单"),
        "message": _pick_string(input_value, "message"),
        "status": status if status in SUPPORT_STATUSES else "new",
        "replyDraft": _pick_string(input_value, "replyDraft"),
        "reviewNotes": _pick_string(input_value, "reviewNotes"),
        "workflowRunId": _pick_string(input_value, "workflowRunId") or None,
        "workflowScenarioId": _pick_string(input_value, "workflowScenarioId") or None,
        "workflowStageId": _pick_string(input_value, "workflowStageId") or None,
        "workflowSource": _pick_string(input_value, "workflowSource") or None,
        "workflowNextStep": _pick_string(input_value, "workflowNextStep") or None,
        "workflowTriggerType": (
            input_value.get("workflowTriggerType")
            if input_value.get("workflowTriggerType") in WORKFLOW_TRIGGER_TYPES
            else None
        ),
        "createdAt": created_at,
        "updatedAt": updated_at,
    }


def _normalize_support_entry(input_value: Any) -> dict[str, Any] | None:
    return _normalize_basic_tombstone(input_value) or _normalize_support_ticket(input_value)


def _normalize_support_entries(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    deduped: dict[str, dict[str, Any]] = {}
    for item in raw:
        entry = _normalize_support_entry(item)
        if entry is None:
            continue
        existing = deduped.get(entry["id"])
        if existing is None or int(existing["updatedAt"]) < int(entry["updatedAt"]):
            deduped[entry["id"]] = entry
        elif (
            int(existing["updatedAt"]) == int(entry["updatedAt"])
            and not _is_tombstone(existing)
            and _is_tombstone(entry)
        ):
            deduped[entry["id"]] = entry
    return sorted(deduped.values(), key=lambda item: int(item["updatedAt"]), reverse=True)[:MAX_SUPPORT_TICKETS]


def list_support_ticket_store_snapshot() -> dict[str, list[dict[str, Any]]]:
    entries = _normalize_support_entries(read_json("support-tickets.json", []))
    return {
        "tickets": _live_entries(entries),
        "tombstones": _tombstone_entries(entries),
    }


def write_support_tickets_to_store(input_value: Any) -> list[dict[str, Any]]:
    normalized = _live_entries(_normalize_support_entries(input_value))
    write_json("support-tickets.json", normalized)
    return normalized


def upsert_support_ticket_in_store(input_value: Any) -> dict[str, Any]:
    candidate = _normalize_support_ticket(input_value)
    if candidate is None:
        return {"ticket": None, "tombstone": None, "accepted": False}

    entries = _normalize_support_entries(read_json("support-tickets.json", []))
    existing = next((entry for entry in entries if entry["id"] == candidate["id"]), None)
    if existing and (
        int(existing["updatedAt"]) > int(candidate["updatedAt"])
        or (int(existing["updatedAt"]) == int(candidate["updatedAt"]) and _is_tombstone(existing))
    ):
        return {
            "ticket": None if _is_tombstone(existing) else existing,
            "tombstone": existing if _is_tombstone(existing) else None,
            "accepted": False,
        }

    next_entries = [candidate, *[entry for entry in entries if entry["id"] != candidate["id"]]]
    next_entries = sorted(next_entries, key=lambda item: int(item["updatedAt"]), reverse=True)[:MAX_SUPPORT_TICKETS]
    write_json("support-tickets.json", next_entries)
    stored = next(
        (entry for entry in next_entries if entry["id"] == candidate["id"] and not _is_tombstone(entry)),
        candidate,
    )
    return {"ticket": stored, "tombstone": None, "accepted": True}


def remove_support_ticket_from_store(
    ticket_id: str,
    updated_at: int | float | None = None,
) -> dict[str, Any]:
    normalized_id = ticket_id.strip()
    if not normalized_id:
        return {"removed": False, "conflict": False, "ticket": None, "tombstone": None}

    entries = _normalize_support_entries(read_json("support-tickets.json", []))
    existing = next((entry for entry in entries if entry["id"] == normalized_id), None)
    if existing is None:
        deleted_at = _now_ms()
        tombstone = {"id": normalized_id, "updatedAt": deleted_at, "deletedAt": deleted_at}
        write_json("support-tickets.json", [tombstone, *entries][:MAX_SUPPORT_TICKETS])
        return {"removed": True, "conflict": False, "ticket": None, "tombstone": tombstone}

    if _is_tombstone(existing):
        conflict = isinstance(updated_at, (int, float)) and int(existing["updatedAt"]) > int(updated_at)
        return {"removed": False, "conflict": conflict, "ticket": None, "tombstone": existing}

    if isinstance(updated_at, (int, float)) and int(existing["updatedAt"]) > int(updated_at):
        return {"removed": False, "conflict": True, "ticket": existing, "tombstone": None}

    deleted_at = _now_ms()
    tombstone = {"id": normalized_id, "updatedAt": deleted_at, "deletedAt": deleted_at}
    next_entries = [tombstone, *[entry for entry in entries if entry["id"] != normalized_id]][
        :MAX_SUPPORT_TICKETS
    ]
    write_json("support-tickets.json", next_entries)
    return {"removed": True, "conflict": False, "ticket": existing, "tombstone": tombstone}


def _normalize_workflow_stage_run(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None
    stage_id = str(input_value.get("id") or "").strip()
    title = str(input_value.get("title") or "").strip()
    mode = str(input_value.get("mode") or "").strip()
    if not stage_id or not title or not mode:
        return None
    state = str(input_value.get("state") or "").strip()
    return {
        "id": stage_id,
        "title": title,
        "mode": mode,
        "state": state if state in WORKFLOW_STAGE_STATES else "pending",
    }


def _normalize_workflow_run(input_value: Any) -> dict[str, Any] | None:
    if not isinstance(input_value, dict):
        return None
    run_id = str(input_value.get("id") or "").strip()
    scenario_id = str(input_value.get("scenarioId") or "").strip()
    scenario_title = str(input_value.get("scenarioTitle") or "").strip()
    if not run_id or not scenario_id or not scenario_title:
        return None

    raw_stage_runs = input_value.get("stageRuns")
    stage_runs = []
    if isinstance(raw_stage_runs, list):
        for item in raw_stage_runs:
            stage = _normalize_workflow_stage_run(item)
            if stage is not None:
                stage_runs.append(stage)

    created_at = _normalize_timestamp(input_value.get("createdAt"))
    updated_at = _normalize_timestamp(input_value.get("updatedAt"), created_at)
    trigger_type = str(input_value.get("triggerType") or "").strip()
    state = str(input_value.get("state") or "").strip()

    return {
        "id": run_id,
        "scenarioId": scenario_id,
        "scenarioTitle": scenario_title,
        "triggerType": trigger_type if trigger_type in WORKFLOW_TRIGGER_TYPES else "manual",
        "state": state if state in WORKFLOW_RUN_STATES else "idle",
        "currentStageId": _pick_string(input_value, "currentStageId") or None,
        "stageRuns": stage_runs,
        "createdAt": created_at,
        "updatedAt": updated_at,
    }


def _normalize_workflow_run_tombstone(input_value: Any) -> dict[str, Any] | None:
    base = _normalize_basic_tombstone(input_value)
    if base is None:
        return None
    if not isinstance(input_value, dict):
        return None
    scenario_id = str(input_value.get("scenarioId") or "").strip()
    if not scenario_id:
        return None
    base["scenarioId"] = scenario_id
    return base


def _normalize_workflow_entry(input_value: Any) -> dict[str, Any] | None:
    return _normalize_workflow_run_tombstone(input_value) or _normalize_workflow_run(input_value)


def _compare_workflow_run_priority(left: dict[str, Any], right: dict[str, Any]) -> int:
    left_created = int(left.get("createdAt") or 0)
    right_created = int(right.get("createdAt") or 0)
    if left_created != right_created:
        return left_created - right_created
    left_updated = int(left.get("updatedAt") or 0)
    right_updated = int(right.get("updatedAt") or 0)
    if left_updated != right_updated:
        return left_updated - right_updated
    left_id = str(left.get("id") or "")
    right_id = str(right.get("id") or "")
    if left_id < right_id:
        return -1
    if left_id > right_id:
        return 1
    return 0


def _normalize_workflow_entries(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []

    by_id: dict[str, dict[str, Any]] = {}
    for item in raw:
        entry = _normalize_workflow_entry(item)
        if entry is None:
            continue
        existing = by_id.get(entry["id"])
        if existing is None or int(existing["updatedAt"]) < int(entry["updatedAt"]):
            by_id[entry["id"]] = entry
        elif (
            int(existing["updatedAt"]) == int(entry["updatedAt"])
            and not _is_tombstone(existing)
            and _is_tombstone(entry)
        ):
            by_id[entry["id"]] = entry

    live_by_scenario: dict[str, dict[str, Any]] = {}
    for entry in by_id.values():
        if _is_tombstone(entry):
            continue
        existing = live_by_scenario.get(entry["scenarioId"])
        if existing is None or _compare_workflow_run_priority(existing, entry) < 0:
            live_by_scenario[entry["scenarioId"]] = entry

    next_entries: list[dict[str, Any]] = []
    tombstones: dict[str, dict[str, Any]] = {}
    for entry in by_id.values():
        if _is_tombstone(entry):
            existing = tombstones.get(entry["id"])
            if existing is None or int(existing["updatedAt"]) <= int(entry["updatedAt"]):
                tombstones[entry["id"]] = entry
            continue

        active = live_by_scenario.get(entry["scenarioId"])
        if active is not None and active["id"] == entry["id"]:
            next_entries.append(entry)
            continue

        deleted_at = max(int(entry["updatedAt"]), int((active or {}).get("createdAt") or entry["updatedAt"]))
        tombstone = {
            "id": entry["id"],
            "scenarioId": entry["scenarioId"],
            "updatedAt": deleted_at,
            "deletedAt": deleted_at,
        }
        existing = tombstones.get(entry["id"])
        if existing is None or int(existing["updatedAt"]) <= deleted_at:
            tombstones[entry["id"]] = tombstone

    combined = [*next_entries, *tombstones.values()]
    combined.sort(key=lambda item: int(item["updatedAt"]), reverse=True)
    return combined[:MAX_WORKFLOW_RUNS]


def list_workflow_run_store_snapshot() -> dict[str, list[dict[str, Any]]]:
    entries = _normalize_workflow_entries(read_json("workflow-runs.json", []))
    return {
        "workflowRuns": _live_entries(entries),
        "tombstones": _tombstone_entries(entries),
    }


def write_workflow_runs_to_store(input_value: Any) -> list[dict[str, Any]]:
    normalized = _live_entries(_normalize_workflow_entries(input_value))
    write_json("workflow-runs.json", normalized)
    return normalized


def upsert_workflow_run_in_store(input_value: Any) -> dict[str, Any]:
    candidate = _normalize_workflow_run(input_value)
    if candidate is None:
        return {"workflowRun": None, "tombstone": None, "accepted": False}

    entries = _normalize_workflow_entries(read_json("workflow-runs.json", []))
    existing = next((entry for entry in entries if entry["id"] == candidate["id"]), None)
    if existing is not None and _is_tombstone(existing):
        return {"workflowRun": None, "tombstone": existing, "accepted": False}
    if existing is not None and not _is_tombstone(existing) and int(existing["updatedAt"]) > int(candidate["updatedAt"]):
        return {"workflowRun": existing, "tombstone": None, "accepted": False}

    active_scenario_run = next(
        (
            entry
            for entry in entries
            if not _is_tombstone(entry)
            and entry["scenarioId"] == candidate["scenarioId"]
            and entry["id"] != candidate["id"]
        ),
        None,
    )
    if active_scenario_run is not None and _compare_workflow_run_priority(active_scenario_run, candidate) >= 0:
        return {"workflowRun": active_scenario_run, "tombstone": None, "accepted": False}

    next_entries = _normalize_workflow_entries(
        [candidate, *[entry for entry in entries if entry["id"] != candidate["id"]]]
    )
    write_json("workflow-runs.json", next_entries)
    candidate_tombstone = next(
        (entry for entry in next_entries if _is_tombstone(entry) and entry["id"] == candidate["id"]),
        None,
    )
    if candidate_tombstone is not None:
        return {"workflowRun": None, "tombstone": candidate_tombstone, "accepted": False}

    winner = next(
        (
            entry
            for entry in next_entries
            if not _is_tombstone(entry) and entry["scenarioId"] == candidate["scenarioId"]
        ),
        candidate,
    )
    return {"workflowRun": winner, "tombstone": None, "accepted": True}


def remove_workflow_run_from_store(
    run_id: str,
    updated_at: int | float | None = None,
) -> dict[str, Any]:
    normalized_id = run_id.strip()
    if not normalized_id:
        return {"removed": False, "conflict": False, "workflowRun": None, "tombstone": None}

    entries = _normalize_workflow_entries(read_json("workflow-runs.json", []))
    existing = next((entry for entry in entries if entry["id"] == normalized_id), None)
    if existing is None:
        return {"removed": False, "conflict": False, "workflowRun": None, "tombstone": None}
    if _is_tombstone(existing):
        return {"removed": False, "conflict": False, "workflowRun": None, "tombstone": existing}
    if isinstance(updated_at, (int, float)) and int(existing["updatedAt"]) > int(updated_at):
        return {"removed": False, "conflict": True, "workflowRun": existing, "tombstone": None}

    deleted_at = _now_ms()
    tombstone = {
        "id": normalized_id,
        "scenarioId": existing["scenarioId"],
        "updatedAt": deleted_at,
        "deletedAt": deleted_at,
    }
    next_entries = _normalize_workflow_entries(
        [tombstone, *[entry for entry in entries if entry["id"] != normalized_id]]
    )
    write_json("workflow-runs.json", next_entries)
    stored_tombstone = next(
        (entry for entry in next_entries if _is_tombstone(entry) and entry["id"] == normalized_id),
        tombstone,
    )
    return {
        "removed": True,
        "conflict": False,
        "workflowRun": existing,
        "tombstone": stored_tombstone,
    }

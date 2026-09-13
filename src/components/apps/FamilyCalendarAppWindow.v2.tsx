"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FilePlus2, Plus, Sparkles, Trash2 } from "lucide-react";
import type { AppWindowProps } from "@/apps/types";
import { AppToast } from "@/components/AppToast";
import { AppWindowShell } from "@/components/windows/AppWindowShell";
import { useTimedToast } from "@/hooks/useTimedToast";
import { createDraft } from "@/lib/drafts";
import { getOutputLanguageInstruction } from "@/lib/language";
import {
  createFamilyEvent,
  createHouseholdItem,
  getFamilyEvents,
  getHouseholdItems,
  removeFamilyEvent,
  removeHouseholdItem,
  subscribeHousehold,
  updateFamilyEvent,
  updateHouseholdItem,
  type FamilyEvent,
  type HouseholdItem,
} from "@/lib/household";
import { requestOpenClawAgent } from "@/lib/openclaw-agent-client";
import { createTask, updateTask } from "@/lib/tasks";
import { requestOpenApp } from "@/lib/ui-events";
import { Button } from "@/design-system/components/Button";
import { Input } from "@/design-system/components/Input";
import { Textarea } from "@/design-system/components/Textarea";
import { Card, CardHeader, CardBody, CardDivider } from "@/design-system/components/Card";
import { Badge } from "@/design-system/components/Badge";

function buildLocalPlan(events: FamilyEvent[], items: HouseholdItem[], focusDate: string) {
  const sameDay = events.filter((event) => event.date === focusDate);
  const neededItems = items.filter((item) => item.needed);
  return [
    "【Family Morning Plan】",
    `- 日期：${focusDate || "今天"}`,
    "",
    "【日程】",
    ...(sameDay.length > 0
      ? sameDay.map((event) => `- ${event.time || "--:--"} ${event.member || "家庭成员"}：${event.title}`)
      : ["- 今天还没有记录的家庭日程。"]),
    "",
    "【补货 / 家务】",
    ...(neededItems.length > 0
      ? neededItems.map((item) => `- ${item.name}${item.quantity ? ` | 余量：${item.quantity}` : ""}`)
      : ["- 暂无待补货项目。"]),
    "",
    "【建议】",
    "- 先确认今天必须外出的事项和接送时间。",
    "- 把需要采购或提醒的事项转成任务，避免晨间遗漏。",
    "- 如有多人协同，建议提前发一条家庭群提醒。",
  ].join("\n");
}

export function FamilyCalendarAppWindow({
  state,
  zIndex,
  active,
  onFocus,
  onMinimize,
  onClose,
}: AppWindowProps) {
  const isVisible = state === "open" || state === "opening";
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [items, setItems] = useState<HouseholdItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState(new Date().toISOString().slice(0, 10));
  const [plan, setPlan] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast, showToast } = useTimedToast(2200);

  useEffect(() => {
    if (!isVisible) return;
    const sync = () => {
      const nextEvents = getFamilyEvents();
      const nextItems = getHouseholdItems();
      setEvents(nextEvents);
      setItems(nextItems);
      setSelectedEventId((current) => current ?? nextEvents[0]?.id ?? null);
      setSelectedItemId((current) => current ?? nextItems[0]?.id ?? null);
    };
    sync();
    const unsub = subscribeHousehold(sync);
    const onStorage = () => sync();
    window.addEventListener("storage", onStorage);
    return () => {
      unsub();
      window.removeEventListener("storage", onStorage);
    };
  }, [isVisible]);

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId],
  );

  const createNewEvent = () => {
    const id = createFamilyEvent({ date: focusDate });
    setSelectedEventId(id);
    showToast("已新增家庭日程", "ok");
  };

  const createNewItem = () => {
    const id = createHouseholdItem();
    setSelectedItemId(id);
    showToast("已新增家庭物品", "ok");
  };

  const generatePlan = async () => {
    const fallback = buildLocalPlan(events, items, focusDate);
    const taskId = createTask({
      name: "Assistant - Family calendar plan",
      status: "running",
      detail: focusDate,
    });
    setIsGenerating(true);
    try {
      const dayEvents = events
        .filter((event) => event.date === focusDate)
        .map((event) => `- ${event.time || "--:--"} | ${event.member || "成员"} | ${event.title} | ${event.notes}`)
        .join("\n");
      const stock = items
        .filter((item) => item.needed)
        .map((item) => `- ${item.name} | 余量: ${item.quantity || "未知"} | ${item.notes}`)
        .join("\n");
      const message =
        "你是 Family Calendar & Household Assistant。请基于家庭日程和待补货事项，生成一份中文晨间计划。\n" +
        `${getOutputLanguageInstruction()}\n` +
        "要求：\n" +
        "1) 先列出今天关键安排。\n" +
        "2) 再列出需要提醒或采购的事项。\n" +
        "3) 给出一段简短的家庭协作建议。\n\n" +
        `日期：${focusDate}\n` +
        `日程：\n${dayEvents || "(空)"}\n` +
        `补货/家务：\n${stock || "(空)"}`;

      const text = await requestOpenClawAgent({
        message,
        sessionId: "webos-family-calendar",
        timeoutSeconds: 90,
      });
      setPlan(text || fallback);
      updateTask(taskId, { status: "done" });
      showToast("家庭计划已生成", "ok");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "生成失败";
      setPlan(fallback);
      updateTask(taskId, { status: "error", detail: errorMessage });
      showToast("智能执行不可用，已切换本地计划", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const savePlanDraft = () => {
    if (!plan.trim()) {
      showToast("请先生成家庭计划", "error");
      return;
    }
    createDraft({
      title: `Family Plan ${focusDate}`,
      body: plan,
      tags: ["family", "calendar"],
      source: "import",
    });
    showToast("已保存到草稿", "ok");
  };

  const queueNeededItems = () => {
    const neededItems = items.filter((item) => item.needed);
    if (neededItems.length === 0) {
      showToast("当前没有待补货项目", "error");
      return;
    }
    for (const item of neededItems) {
      createTask({
        name: `Family - ${item.name}`,
        status: "queued",
        detail: item.quantity || "家庭补货 / 处理",
      });
    }
    requestOpenApp("task_manager");
    showToast(`已写入 ${neededItems.length} 个家庭任务`, "ok");
  };

  return (
    <AppWindowShell
      state={state}
      zIndex={zIndex}
      active={active}
      title="Family Calendar"
      icon={CalendarDays}
      widthClassName="w-[1180px]"
      storageKey="openclaw.window.family_calendar"
      onFocus={onFocus}
      onMinimize={onMinimize}
      onClose={onClose}
    >
      <div className="relative bg-white">
        <AppToast toast={toast} />

        <div className="border-b border-gray-200 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Family Calendar & Household Assistant</h1>
              <p className="mt-2 text-sm text-gray-600">
                聚合家庭日程、家务与补货事项，生成一份晨间家庭计划。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info" size="md">
                日程 {events.length}
              </Badge>
              <Badge variant="info" size="md">
                家务 / 补货 {items.length}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 p-6 xl:grid-cols-[330px_330px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="家庭日程"
                action={
                  <Button size="sm" variant="primary" icon={Plus} onClick={createNewEvent}>
                    新建
                  </Button>
                }
              />
              <CardDivider />
              <CardBody spacing="sm">
                {events.length > 0 ? (
                  events.slice(0, 8).map((event) => {
                    const isActive = event.id === selectedEventId;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className={[
                          "w-full rounded-xl border p-3 text-left transition-all",
                          isActive
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold text-gray-900">{event.title}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {[event.date, event.time, event.member].filter(Boolean).join(" · ") || "待补充"}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    还没有家庭日程。
                  </div>
                )}
              </CardBody>
            </Card>

            {selectedEvent && (
              <Card padding="md">
                <CardHeader
                  title="编辑日程"
                  action={
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={() => {
                        removeFamilyEvent(selectedEvent.id);
                        setSelectedEventId(null);
                        showToast("家庭日程已删除", "ok");
                      }}
                    >
                      删除
                    </Button>
                  }
                />
                <CardDivider />
                <CardBody spacing="md">
                  <Input
                    value={selectedEvent.title}
                    onChange={(e) => updateFamilyEvent(selectedEvent.id, { title: e.target.value })}
                    placeholder="事项"
                    fullWidth
                  />
                  <Input
                    value={selectedEvent.member}
                    onChange={(e) => updateFamilyEvent(selectedEvent.id, { member: e.target.value })}
                    placeholder="成员"
                    fullWidth
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      type="date"
                      value={selectedEvent.date}
                      onChange={(e) => updateFamilyEvent(selectedEvent.id, { date: e.target.value })}
                      fullWidth
                    />
                    <Input
                      type="time"
                      value={selectedEvent.time}
                      onChange={(e) => updateFamilyEvent(selectedEvent.id, { time: e.target.value })}
                      fullWidth
                    />
                  </div>
                  <Textarea
                    value={selectedEvent.notes}
                    onChange={(e) => updateFamilyEvent(selectedEvent.id, { notes: e.target.value })}
                    placeholder="备注"
                    rows={5}
                    fullWidth
                  />
                </CardBody>
              </Card>
            )}
          </aside>

          <aside className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="补货 / 家务"
                action={
                  <Button size="sm" variant="primary" icon={Plus} onClick={createNewItem}>
                    新建
                  </Button>
                }
              />
              <CardDivider />
              <CardBody spacing="sm">
                {items.length > 0 ? (
                  items.slice(0, 8).map((item) => {
                    const isActive = item.id === selectedItemId;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedItemId(item.id)}
                        className={[
                          "w-full rounded-xl border p-3 text-left transition-all",
                          isActive
                            ? "border-blue-500 bg-blue-50 shadow-sm"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        <div className="text-sm font-semibold text-gray-900">{item.name}</div>
                        <div className="mt-1 text-xs text-gray-500">
                          {item.needed ? "待处理" : "正常"} {item.quantity ? `· ${item.quantity}` : ""}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                    还没有家庭物品。
                  </div>
                )}
              </CardBody>
            </Card>

            {selectedItem && (
              <Card padding="md">
                <CardHeader
                  title="编辑物品"
                  action={
                    <Button
                      size="sm"
                      variant="danger"
                      icon={Trash2}
                      onClick={() => {
                        removeHouseholdItem(selectedItem.id);
                        setSelectedItemId(null);
                        showToast("家庭物品已删除", "ok");
                      }}
                    >
                      删除
                    </Button>
                  }
                />
                <CardDivider />
                <CardBody spacing="md">
                  <Input
                    value={selectedItem.name}
                    onChange={(e) => updateHouseholdItem(selectedItem.id, { name: e.target.value })}
                    placeholder="物品"
                    fullWidth
                  />
                  <Input
                    value={selectedItem.quantity}
                    onChange={(e) => updateHouseholdItem(selectedItem.id, { quantity: e.target.value })}
                    placeholder="余量 / 数量"
                    fullWidth
                  />
                  <label className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedItem.needed}
                      onChange={(e) => updateHouseholdItem(selectedItem.id, { needed: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    标记为待补货 / 待处理
                  </label>
                  <Textarea
                    value={selectedItem.notes}
                    onChange={(e) => updateHouseholdItem(selectedItem.id, { notes: e.target.value })}
                    placeholder="备注"
                    rows={4}
                    fullWidth
                  />
                </CardBody>
              </Card>
            )}
          </aside>

          <main className="space-y-4">
            <Card padding="md">
              <CardHeader
                title="家庭计划"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="success"
                      icon={Sparkles}
                      onClick={generatePlan}
                      disabled={isGenerating}
                      loading={isGenerating}
                    >
                      {isGenerating ? "生成中..." : "生成家庭计划"}
                    </Button>
                    <Button size="sm" variant="secondary" icon={FilePlus2} onClick={savePlanDraft}>
                      保存草稿
                    </Button>
                    <Button size="sm" variant="secondary" onClick={queueNeededItems}>
                      写入家庭任务
                    </Button>
                  </div>
                }
              />
              <CardDivider />
              <CardBody spacing="md">
                <div>
                  <label htmlFor="focus-date-input" className="mb-2 block text-xs font-semibold text-gray-600">
                    计划日期
                  </label>
                  <Input
                    id="focus-date-input"
                    type="date"
                    value={focusDate}
                    onChange={(e) => setFocusDate(e.target.value)}
                    fullWidth
                  />
                </div>
                <div className="min-h-[520px]">
                  {plan ? (
                    <pre className="whitespace-pre-wrap text-sm leading-7 text-gray-800">{plan}</pre>
                  ) : (
                    <div className="flex min-h-[480px] items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500">
                      生成后，这里会出现家庭晨间计划。
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          </main>
        </div>
      </div>
    </AppWindowShell>
  );
}

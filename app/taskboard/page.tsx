import { Shell } from "@/components/ipad/Shell";
import { OPENCLAW_TASKBOARD_UI_URL } from "@/lib/config";
import { dict, getLangFromSearchParams } from "@/lib/i18n";
import { getTaskboardSummary, type TaskboardSummary } from "@/lib/taskboardSummary";

type ApiOk = Pick<TaskboardSummary, "ok" | "total" | "segs" | "topTasks" | "topProjects">;

type ApiErr = { ok: false; error: string };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getSummary(): Promise<ApiOk | ApiErr> {
  try {
    const summary = await getTaskboardSummary();
    return summary;
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export default async function Page({ searchParams }: Props) {
  const sp = new URLSearchParams();
  const rawParams = (await searchParams) || {};
  for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);
  const s = await getSummary();

  return (
    <Shell
      lang={lang}
      title={t.taskboard}
      subtitle={t.taskboardDesc}
      backHref={`/?lang=${lang}`}
      backLabel={t.desktop}
    >
      <section className="rounded-[28px] oc-glass p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900/85">{t.today}</div>
            <div className="mt-1 text-xs text-slate-600/80">{t.fromJsonl}</div>
          </div>
          <a
            href={OPENCLAW_TASKBOARD_UI_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-white/60 px-3 py-2 text-xs font-medium text-slate-900/80 oc-soft-ring hover:bg-white/70"
          >
            {t.openTaskboardUi}
          </a>
        </div>

        {!s.ok ? (
          <p className="mt-3 text-sm text-rose-600">{s.error}</p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] bg-white/60 p-4 oc-soft-ring">
              <div className="text-xs uppercase tracking-[0.20em] text-slate-500/80">{t.total}</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{s.total}</div>
              <div className="mt-1 text-xs text-slate-600">{t.segments}: {s.segs}</div>
            </div>

            <div className="rounded-[22px] bg-white/60 p-4 oc-soft-ring">
              <div className="text-xs uppercase tracking-[0.20em] text-slate-500/80">{t.topTasks}</div>
              <div className="mt-2 space-y-2 text-sm">
                {s.topTasks.map((task, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="truncate text-slate-900">{task.title}</div>
                    <div className="font-mono text-xs text-slate-500">{task.hhmmss}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[22px] bg-white/60 p-4 oc-soft-ring md:col-span-2">
              <div className="text-xs uppercase tracking-[0.20em] text-slate-500/80">{t.topProjects}</div>
              <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {s.topProjects.map((project, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <div className="truncate text-slate-900">{project.name}</div>
                    <div className="font-mono text-xs text-slate-500">{project.hhmmss}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </Shell>
  );
}

import { Shell } from "@/components/ipad/Shell";
import { dict, getLangFromSearchParams } from "@/lib/i18n";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ params, searchParams }: Props) {
  const { id } = await params;

  const sp = new URLSearchParams();
  const raw = (await searchParams) || {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);

  const withLang = (href: string) => `${href}?lang=${lang}`;

  return (
    <Shell
      lang={lang}
      title={id}
      subtitle={t.automationsDesc}
      backHref={withLang("/automations")}
      backLabel={t.automations}
    >
      <section className="rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">
          {lang === "zh" ? "状态" : "Status"}
        </div>
        <div className="mt-2 text-xs text-slate-600/80">
          {lang === "zh"
            ? "（占位）后续这里会显示：上次运行时间、耗时、结果、错误信息"
            : "(placeholder) Shows last run time, duration, result, and errors"}
        </div>
      </section>

      <section className="mt-4 rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">
          {lang === "zh" ? "运行" : "Run"}
        </div>
        <div className="mt-2 text-xs text-slate-600/80">
          {lang === "zh"
            ? "（占位）第一版只做模拟运行，不会执行任何真实动作。"
            : "(placeholder) First version is mock-only. No real actions."}
        </div>
        <button
          className="mt-4 rounded-full bg-white/60 px-4 py-2 text-xs font-medium text-slate-900/80 oc-soft-ring disabled:opacity-50"
          disabled
          title={lang === "zh" ? "下一步再接" : "Wiring next"}
        >
          {lang === "zh" ? "模拟运行（下一步）" : "Mock Run (next)"}
        </button>
      </section>

      <section className="mt-4 rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">
          {lang === "zh" ? "配置（JSON）" : "Config (JSON)"}
        </div>
        <div className="mt-2 text-xs text-slate-600/80">
          {lang === "zh"
            ? "（占位）后续这里会是可校验的 JSON 配置表单。"
            : "(placeholder) Will become a validated JSON config form."}
        </div>
        <textarea
          className="mt-4 h-40 w-full resize-none rounded-[24px] bg-slate-950/90 p-4 font-mono text-xs text-slate-100 oc-soft-ring"
          defaultValue={"{\n  \"enabled\": false\n}"}
          readOnly
        />
      </section>

      <section className="mt-4 rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">
          {lang === "zh" ? "运行日志" : "Run Logs"}
        </div>
        <div className="mt-2 text-xs text-slate-600/80">
          {lang === "zh"
            ? "（占位）后续这里会显示可复制/可下载的日志。"
            : "(placeholder) Will show copyable/downloadable logs."}
        </div>
      </section>
    </Shell>
  );
}

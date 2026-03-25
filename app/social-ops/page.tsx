import { Shell } from "@/components/ipad/Shell";
import { SocialOpsMockRunner } from "@/components/socialops/MockRunner";
import { dict, getLangFromSearchParams } from "@/lib/i18n";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
  const sp = new URLSearchParams();
  const raw = (await searchParams) || {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);

  const title = lang === "zh" ? "社媒运营" : "Social Ops";
  const subtitle =
    lang === "zh"
      ? "文案 -> 分镜 -> 字幕草稿 ->（未来）发布。当前仅模拟运行，不发布。"
      : "Copy -> shotlist -> captions drafts -> (future) publish. Mock-only for now.";

  return (
    <Shell
      lang={lang}
      title={title}
      subtitle={subtitle}
      backHref={`/?lang=${lang}`}
      backLabel={t.desktop}
    >
      <section className="rounded-[28px] oc-glass p-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900/85">
              {lang === "zh" ? "流程" : "Flow"}
            </div>
            <div className="mt-1 text-xs text-slate-600/80">
              {lang === "zh"
                ? "一条从选题到视频制作的自动线（发布阶段默认禁用）"
                : "A pipeline from brief to video production (publishing disabled by default)"}
            </div>
          </div>
          <div className="rounded-full bg-white/60 px-3 py-2 text-[11px] font-medium text-slate-900/70 oc-soft-ring">
            {lang === "zh" ? "安全模式" : "Safe mode"}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            lang === "zh" ? "1) Brief" : "1) Brief",
            lang === "zh" ? "2) 文案/脚本" : "2) Copy",
            lang === "zh" ? "3) 分镜" : "3) Shotlist",
            lang === "zh" ? "4) 字幕" : "4) Captions",
            lang === "zh" ? "5) 发布(禁用)" : "5) Publish (off)",
          ].map((s) => (
            <div
              key={s}
              className="rounded-[18px] bg-white/60 px-4 py-3 text-xs font-medium text-slate-900/70 oc-soft-ring"
            >
              {s}
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5">
        <SocialOpsMockRunner lang={lang} />
      </div>
    </Shell>
  );
}

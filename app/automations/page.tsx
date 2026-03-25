import Link from "next/link";
import { Shell } from "@/components/ipad/Shell";
import { dict, getLangFromSearchParams } from "@/lib/i18n";

const AUTOMATIONS = [
  {
    id: "taskboard-summary",
    zh: { name: "Taskboard 计时汇总", desc: "汇总今日用时 / Top 任务 / Top 项目" },
    en: { name: "Taskboard Summary", desc: "Summarize today time / top tasks/projects" },
  },
  {
    id: "jzz1-seo-check",
    zh: { name: "jzz1 SEO 例行检查", desc: "检查关键页面标题/描述/图片等（占位）" },
    en: { name: "jzz1 SEO Check", desc: "Check key pages SEO fields (placeholder)" },
  },
  {
    id: "alibaba-fill-only",
    zh: { name: "Alibaba 填表（不提交）", desc: "半自动填充发布表单（占位）" },
    en: { name: "Alibaba Fill (No Submit)", desc: "Semi-auto fill publish form (placeholder)" },
  },
  {
    id: "daily-weekly-report",
    zh: { name: "日报 / 周报生成", desc: "从日志生成摘要（占位）" },
    en: { name: "Daily/Weekly Report", desc: "Generate a report from logs (placeholder)" },
  },
] as const;

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
  const sp = new URLSearchParams();
  const raw = (await searchParams) || {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);

  const withLang = (href: string) => `${href}?lang=${lang}`;

  return (
    <Shell
      lang={lang}
      title={t.automations}
      subtitle={t.automationsDesc}
      backHref={withLang("/")}
      backLabel={t.desktop}
    >
      <section className="grid gap-3 sm:grid-cols-2">
        {AUTOMATIONS.map((automation) => {
          const meta = lang === "zh" ? automation.zh : automation.en;
          return (
            <Link
              key={automation.id}
              href={withLang(`/automations/${automation.id}`)}
              className="rounded-[24px] bg-white/60 p-5 oc-soft-ring hover:bg-white/70"
            >
              <div className="text-sm font-semibold text-slate-900">{meta.name}</div>
              <div className="mt-2 text-xs leading-5 text-slate-600">{meta.desc}</div>
            </Link>
          );
        })}
      </section>
    </Shell>
  );
}

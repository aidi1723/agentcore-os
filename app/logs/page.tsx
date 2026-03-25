import { Shell } from "@/components/ipad/Shell";
import { dict, getLangFromSearchParams } from "@/lib/i18n";
import { readRecentMemoryLines } from "@/lib/logsData";

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: Props) {
  const sp = new URLSearchParams();
  const rawParams = (await searchParams) || {};
  for (const [k, v] of Object.entries(rawParams)) if (typeof v === "string") sp.set(k, v);
  const lang = getLangFromSearchParams(sp);
  const t = dict(lang);
  const logs = await readRecentMemoryLines();

  return (
    <Shell
      lang={lang}
      title={t.logs}
      subtitle={t.logsDesc}
      backHref={`/?lang=${lang}`}
      backLabel={t.desktop}
    >
      <section className="rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">{t.recentMemory}</div>
        <div className="mt-1 text-xs text-slate-600/80">{t.logsHint}</div>

        {!logs.ok ? (
          <p className="mt-3 text-sm text-rose-600">{logs.error}</p>
        ) : (
          <pre className="mt-4 max-h-[70dvh] overflow-auto rounded-[24px] bg-slate-950/90 p-4 text-xs leading-5 text-slate-100 oc-soft-ring">
            {logs.text}
          </pre>
        )}
      </section>
    </Shell>
  );
}

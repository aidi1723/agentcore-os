import { Shell } from "@/components/ipad/Shell";
import { dict, getLangFromSearchParams } from "@/lib/i18n";
import { getGatewayStatusText } from "@/lib/openclawCli";

type ApiOk = { ok: true; raw: string };
type ApiErr = { ok: false; error: string };

type Props = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

async function getStatus(): Promise<ApiOk | ApiErr> {
  try {
    const raw = await getGatewayStatusText();
    return { ok: true, raw };
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
  const s = await getStatus();

  return (
    <Shell
      lang={lang}
      title={t.gateway}
      subtitle={t.gatewayDesc}
      backHref={`/?lang=${lang}`}
      backLabel={t.desktop}
    >
      <section className="rounded-[28px] oc-glass p-6">
        <div className="text-sm font-semibold tracking-tight text-slate-900/85">{t.cmdGateway}</div>
        {!s.ok ? (
          <p className="mt-3 text-sm text-rose-600">{s.error}</p>
        ) : (
          <pre className="mt-4 max-h-[70dvh] overflow-auto rounded-[24px] bg-slate-950/90 p-4 text-xs leading-5 text-slate-100 oc-soft-ring">
            {s.raw}
          </pre>
        )}
      </section>
    </Shell>
  );
}

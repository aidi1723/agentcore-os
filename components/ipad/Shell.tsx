import Link from "next/link";
import { LangSwitch } from "@/components/LangSwitch";
import { OpenClawStatusPill } from "@/components/OpenClawStatusPill";

export function Shell({
  lang,
  title,
  subtitle,
  backHref,
  backLabel,
  children,
}: {
  lang: "zh" | "en";
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="oc-bg min-h-dvh">
      <header className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-6 pt-8">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="oc-tap rounded-full bg-white/60 px-3 py-2 text-xs font-medium text-slate-900/80 oc-soft-ring hover:bg-white/70"
          >
            {backLabel}
          </Link>
          <div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900/90">
              {title}
            </div>
            {subtitle ? (
              <div className="mt-1 text-xs leading-5 text-slate-600/85">
                {subtitle}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <LangSwitch />
          <OpenClawStatusPill lang={lang} />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="mt-8">{children}</div>
      </main>
    </div>
  );
}

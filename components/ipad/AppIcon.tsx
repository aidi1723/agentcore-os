import Link from "next/link";

export function AppIcon({
  href,
  label,
  glyph,
  sub,
}: {
  href: string;
  label: string;
  glyph: string;
  sub?: string;
}) {
  return (
    <Link href={href} className="group flex flex-col items-center gap-2 oc-tap">
      <div
        className="grid h-[74px] w-[74px] place-items-center rounded-[22px] oc-glass"
        style={{ boxShadow: "var(--oc-shadow-strong)" }}
      >
        <div className="grid h-[62px] w-[62px] place-items-center rounded-[18px] bg-white/70 oc-soft-ring">
          <span className="font-mono text-[18px] tracking-wide text-slate-900/80">
            {glyph}
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[12px] font-medium tracking-tight text-slate-900/90">
          {label}
        </div>
        {sub ? (
          <div className="mt-0.5 text-[10px] text-slate-600/80">{sub}</div>
        ) : null}
      </div>
    </Link>
  );
}

import { AppIcon } from "./AppIcon";

export function Dock({
  items,
}: {
  items: { href: string; label: string; glyph: string }[];
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-5">
      <div
        className="pointer-events-auto flex items-center gap-4 rounded-[28px] px-5 py-4 oc-glass"
        style={{ boxShadow: "var(--oc-shadow-strong)" }}
      >
        {items.map((it) => (
          <div key={it.href} className="scale-[0.92]">
            <AppIcon href={it.href} label={it.label} glyph={it.glyph} />
          </div>
        ))}
      </div>
    </div>
  );
}

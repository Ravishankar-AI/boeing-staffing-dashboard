// Single-series horizontal bars: one hue, direct value labels, a hover
// tooltip per bar (native title) with the share of resumes sent.
export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="flex flex-col gap-3.5">
      {steps.map((s, i) => {
        const pct = Math.round((s.value / max) * 100);
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev ? Math.round((s.value / prev) * 100) : null;
        return (
          <li key={s.label} title={`${s.label}: ${s.value} (${pct}% of resumes sent)`} className="group">
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[0.78rem]">
              <span className="text-ink">{s.label}</span>
              <span className="tabular-nums text-ink-soft">
                <b className="font-display text-[0.95rem] font-extrabold text-ink">{s.value}</b>
                {conv !== null && <span className="ml-2 text-[0.68rem] text-ink-faint">{conv}% of prev.</span>}
              </span>
            </div>
            <div className="h-3 w-full rounded-r bg-track">
              <div
                className="h-3 rounded-r bg-bar transition-opacity group-hover:opacity-80"
                style={{ width: `${Math.max(pct, s.value > 0 ? 1.5 : 0)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

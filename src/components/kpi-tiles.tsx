type Kpi = { label: string; value: number | string; note?: string; emphasis?: boolean };

export function KpiTiles({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line md:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k) => (
        <div key={k.label} className="bg-card p-5">
          <div className="text-[0.66rem] uppercase tracking-wider text-ink-faint">{k.label}</div>
          <div
            className={`mt-1 font-display text-[2.2rem] font-extrabold leading-none tabular-nums ${k.emphasis ? "text-signal-ink" : "text-ink"}`}
          >
            {k.value}
          </div>
          {k.note && <div className="mt-2 text-[0.72rem] text-ink-soft">{k.note}</div>}
        </div>
      ))}
    </div>
  );
}

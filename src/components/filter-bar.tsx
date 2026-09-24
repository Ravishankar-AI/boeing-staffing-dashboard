import { STAGES, STAGE_META } from "@/lib/stages";

type Props = {
  action: string;
  engagements: { code: string; name: string }[];
  values: { engagement?: string; location?: string; stage?: string; q?: string };
  withStage?: boolean;
};

const selectClass =
  "rounded-md border border-line bg-card px-3 py-2 font-mono text-[0.78rem] text-ink focus:border-signal focus:outline-none";

export function FilterBar({ action, engagements, values, withStage }: Props) {
  return (
    <form method="get" action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[0.64rem] uppercase tracking-wider text-ink-faint">
        Engagement
        <select name="engagement" defaultValue={values.engagement ?? ""} className={selectClass}>
          <option value="">All engagements</option>
          {engagements.map((e) => (
            <option key={e.code} value={e.code}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[0.64rem] uppercase tracking-wider text-ink-faint">
        Location
        <select name="location" defaultValue={values.location ?? ""} className={selectClass}>
          <option value="">US + India</option>
          <option value="US">US</option>
          <option value="India">India</option>
        </select>
      </label>
      {withStage && (
        <>
          <label className="flex flex-col gap-1 text-[0.64rem] uppercase tracking-wider text-ink-faint">
            Status
            <select name="stage" defaultValue={values.stage ?? ""} className={selectClass}>
              <option value="">Any status</option>
              <option value="active">Active (in process)</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[0.64rem] uppercase tracking-wider text-ink-faint">
            Candidate
            <input name="q" defaultValue={values.q ?? ""} placeholder="Search name" className={selectClass} />
          </label>
        </>
      )}
      <button
        type="submit"
        className="rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90"
      >
        Apply
      </button>
    </form>
  );
}

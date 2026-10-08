import type { ReactNode } from "react";
import { STAGES, STAGE_META } from "@/lib/stages";

type Group = { label: string; options: { id: string; label: string }[] };
type Values = {
  positionId?: string;
  candidateName?: string;
  sentAt?: Date | null;
  stage?: string;
  interviewer?: string | null;
  interviewAt?: Date | null;
  screeningNotes?: string | null;
  feedback?: string | null;
  onboardingNotes?: string | null;
};

const field = "rounded-md border border-line bg-card px-3 py-2 font-mono text-[0.82rem] text-ink focus:border-signal focus:outline-none";
const label = "flex flex-col gap-1 text-[0.66rem] uppercase tracking-wider text-ink-faint";
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

/** Shared by Add resume and Edit candidate. `id` present = edit. */
export function SubmissionForm({
  action,
  groups,
  values = {},
  id,
  submitLabel,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  groups: Group[];
  values?: Values;
  id?: string;
  submitLabel: string;
  children?: ReactNode;
}) {
  return (
    <form action={action} className="flex flex-col gap-5 rounded-md border border-line bg-card p-6">
      {id && <input type="hidden" name="id" value={id} />}
      <label className={label}>
        Position
        <select name="positionId" required defaultValue={values.positionId} className={field}>
          {groups.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label className={label}>
        Candidate name
        <input name="candidateName" required defaultValue={values.candidateName} className={field} />
      </label>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className={label}>
          Date sent to Boeing
          <input type="date" name="sentAt" required defaultValue={day(values.sentAt ?? new Date())} className={field} />
        </label>
        <label className={label}>
          Status
          <select name="stage" defaultValue={values.stage ?? "submitted"} className={field}>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_META[s].label}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Reviewer / interviewer
          <input name="interviewer" defaultValue={values.interviewer ?? ""} className={field} />
        </label>
        <label className={label}>
          Interview date
          <input type="date" name="interviewAt" defaultValue={day(values.interviewAt)} className={field} />
        </label>
      </div>
      <label className={label}>
        Screening remarks
        <textarea name="screeningNotes" rows={2} defaultValue={values.screeningNotes ?? ""} className={field} />
      </label>
      <label className={label}>
        Interview feedback
        <textarea name="feedback" rows={2} defaultValue={values.feedback ?? ""} className={field} />
      </label>
      <label className={label}>
        Onboarding notes
        <textarea name="onboardingNotes" rows={2} defaultValue={values.onboardingNotes ?? ""} className={field} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="rounded-pill border border-line-strong bg-line-strong px-5 py-2.5 font-mono text-[0.72rem] uppercase tracking-wider text-paper hover:opacity-90"
        >
          {submitLabel}
        </button>
        {children}
      </div>
    </form>
  );
}

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listPositionOptions, STAGES, STAGE_META } from "@/lib/staffing";
import { createSubmission } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add resume — Boeing Staffing" };

const field = "rounded-md border border-line bg-card px-3 py-2 font-mono text-[0.82rem] text-ink focus:border-signal focus:outline-none";
const label = "flex flex-col gap-1 text-[0.66rem] uppercase tracking-wider text-ink-faint";

export default async function NewSubmissionPage() {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const positions = await listPositionOptions();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Add a resume sent to Boeing</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">It shows up on Boeing&apos;s dashboard as soon as you save.</p>
      <form action={createSubmission} className="flex flex-col gap-5 rounded-md border border-line bg-card p-6">
        <label className={label}>
          Position
          <select name="positionId" required className={field}>
            {positions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.open ? "" : " — filled"}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          Candidate name
          <input name="candidateName" required className={field} />
        </label>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className={label}>
            Date sent to Boeing
            <input type="date" name="sentAt" defaultValue={today} className={field} />
          </label>
          <label className={label}>
            Status
            <select name="stage" defaultValue="submitted" className={field}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_META[s].label}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Reviewer / interviewer
            <input name="interviewer" className={field} />
          </label>
          <label className={label}>
            Interview date
            <input type="date" name="interviewAt" className={field} />
          </label>
        </div>
        <label className={label}>
          Screening remarks
          <textarea name="screeningNotes" rows={3} className={field} />
        </label>
        <button
          type="submit"
          className="self-start rounded-pill border border-line-strong bg-line-strong px-5 py-2.5 font-mono text-[0.72rem] uppercase tracking-wider text-paper hover:opacity-90"
        >
          Save resume
        </button>
      </form>
    </div>
  );
}

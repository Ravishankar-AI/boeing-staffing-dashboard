import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, isStaff } from "@/lib/auth";
import { loadDashboard } from "@/lib/staffing";
import { formatDate } from "@/lib/format";
import { formatSize } from "@/lib/resumes";
import { FilterBar } from "@/components/filter-bar";
import { StagePill } from "@/components/stage-pill";
import { StageSelect } from "@/components/stage-select";

export const dynamic = "force-dynamic";
export const metadata = { title: "Candidates — Objectways Talent" };

const th =
  "border-b-2 border-line-strong pb-3 pr-4 text-left font-mono text-[0.64rem] font-medium uppercase tracking-wider text-ink-faint";
const td = "border-b border-dashed border-line py-3 pr-4 align-top";

export default async function SubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ engagement?: string; location?: string; stage?: string; q?: string; deleted?: string; saved?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const { deleted, saved, ...filters } = await searchParams;
  const data = await loadDashboard(filters);
  const staff = isStaff(session);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[2rem] leading-tight">Candidates</h1>
          <p className="mt-1 text-[0.85rem] text-ink-soft">
            {data.submissions.length} of {data.totals.resumesSent} resumes sent
            {staff ? " · click a name or ✎ Edit to change interview dates, feedback, the name or anything else" : ""}
          </p>
        </div>
        {staff && (
          <Link
            href="/submissions/new"
            className="rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90"
          >
            + Add resume
          </Link>
        )}
      </div>
      {saved && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-line bg-card px-4 py-3 text-[0.82rem]">
          <span className="font-bold text-good" aria-hidden>
            ✓
          </span>
          Saved changes to {saved}.
        </p>
      )}
      {deleted && (
        <p role="status" className="mb-6 flex items-center gap-2 rounded-md border border-line bg-card px-4 py-3 text-[0.82rem]">
          <span className="font-bold text-good" aria-hidden>
            ✓
          </span>
          Deleted {deleted}. It&apos;s recorded in the activity log.
        </p>
      )}
      <div className="mb-6">
        <FilterBar action="/submissions" engagements={data.engagements} values={filters} withStage />
      </div>

      <div className="overflow-x-auto rounded-md border border-line bg-card p-6">
        <table className="w-full min-w-[1200px] border-collapse text-[0.8rem]">
          <thead>
            <tr>
              {["Candidate", "Resume", "Role", "Engagement", "Sent", "Interview", "Interviewer", "Screening / feedback", "Status"].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.submissions.map((s) => (
              <tr key={s.id} className="hover:bg-paper-alt">
                <td className={`${td} font-semibold`}>
                  {staff ? (
                    // Edit lives next to the name: a last-column link sat off
                    // screen in this wide table and people couldn't find it.
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Link href={`/submissions/${s.id}`} className="hover:underline">
                        {s.candidateName}
                      </Link>
                      <Link
                        href={`/submissions/${s.id}`}
                        aria-label={`Edit ${s.candidateName}`}
                        className="rounded-pill border border-line-strong px-2 py-0.5 font-mono text-[0.62rem] font-normal uppercase tracking-wider text-ink hover:bg-paper-alt"
                      >
                        ✎ Edit
                      </Link>
                    </div>
                  ) : (
                    s.candidateName
                  )}
                </td>
                <td className={td}>
                  {s.resume ? (
                    <a
                      href={`/resumes/${s.id}`}
                      title={`${s.resume.filename} · ${formatSize(s.resume.size)}`}
                      aria-label={`Download resume for ${s.candidateName}`}
                      className="whitespace-nowrap text-[0.72rem] uppercase tracking-wider text-signal-ink hover:underline"
                    >
                      ↓ {s.resume.filename.split(".").pop()}
                    </a>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className={td}>
                  {s.positionTitle}
                  <div className="text-[0.7rem] text-ink-faint">{s.positionLocation}</div>
                </td>
                <td className={`${td} text-ink-soft`}>{s.engagementName}</td>
                <td className={`${td} whitespace-nowrap tabular-nums text-ink-soft`}>{formatDate(s.sentAt)}</td>
                <td className={`${td} whitespace-nowrap tabular-nums text-ink-soft`}>{formatDate(s.interviewAt)}</td>
                <td className={`${td} text-ink-soft`}>{s.interviewer ?? "—"}</td>
                <td className={`${td} max-w-[320px] text-[0.74rem] text-ink-soft`}>
                  {[s.screeningNotes, s.feedback, s.onboardingNotes].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className={td}>{staff ? <StageSelect id={s.id} stage={s.stage} /> : <StagePill stage={s.stage} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.submissions.length === 0 && <p className="pt-4 text-ink-faint">No candidates match these filters.</p>}
      </div>
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { loadDashboard, STAGE_META, IN_INTERVIEW_STAGES } from "@/lib/staffing";
import { formatDate, daysSince } from "@/lib/format";
import { KpiTiles } from "@/components/kpi-tiles";
import { Funnel } from "@/components/funnel";
import { FilterBar } from "@/components/filter-bar";
import { StagePill, OpenClosedPill } from "@/components/stage-pill";

export const dynamic = "force-dynamic";

const VIEWER_NOTE = {
  admin: "Client · Boeing · leadership view",
  recruiter: "Client · Boeing · recruiter view",
  client: "Client · Boeing · read-only view",
} as const;

const th =
  "border-b-2 border-line-strong pb-3 pr-4 text-left font-mono text-[0.64rem] font-medium uppercase tracking-wider text-ink-faint";
const td = "border-b border-dashed border-line py-3 pr-4 align-top";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ engagement?: string; location?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const filters = await searchParams;
  const data = await loadDashboard(filters);
  const { totals } = data;
  const now = new Date();
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-8">
      <div className="mb-1 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">{VIEWER_NOTE[session.role]}</div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="text-[2rem] leading-tight sm:text-[2.5rem]">Talent Dashboard</h1>
          <p className="mt-1 text-[0.85rem] text-ink-soft">
            Openings, resumes sent, and interview status across every Boeing engagement · as of {formatDate(now)}
          </p>
        </div>
        <FilterBar action="/" engagements={data.engagements} values={filters} />
      </div>

      <KpiTiles
        kpis={[
          { label: "Open positions", value: totals.open, note: `${totals.openRoles} of ${totals.roles} roles still hiring`, emphasis: true },
          { label: "Positions filled", value: `${totals.filled}/${totals.required}`, note: `${pct(totals.filled, totals.required)}% of headcount` },
          { label: "Resumes sent", value: totals.resumesSent, note: `${totals.last30} in the last 30 days` },
          { label: "In interview process", value: totals.inInterview, note: "Shortlisted → awaiting feedback" },
          { label: "Waiting on Boeing", value: totals.waitingOnBoeing, note: "Resume review or interview feedback" },
          { label: "Selected / onboarded", value: totals.selectedOrOnboarded, note: `${data.byStage.onboarded} onboarded` },
        ]}
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.15fr]">
        <section className="rounded-md border border-line bg-card p-6">
          <h2 className="text-[1.05rem]">Hiring funnel</h2>
          <p className="mb-5 text-[0.75rem] text-ink-faint">Submissions that reached each step</p>
          <Funnel steps={data.funnel} />
          <div className="mt-6 flex flex-col gap-2 border-t border-dashed border-line pt-4 text-[0.74rem]">
            <span className="text-[0.64rem] uppercase tracking-wider text-ink-faint">Dropped out</span>
            {(["screen_rejected", "interview_rejected", "withdrawn"] as const).map((s) => (
              <Link
                key={s}
                href={`/submissions?stage=${s}${qs ? `&${qs}` : ""}`}
                className="flex items-center justify-between gap-2 hover:underline"
              >
                <StagePill stage={s} />
                <b className="tabular-nums">{data.byStage[s]}</b>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-md border border-line bg-card p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[1.05rem]">Waiting on Boeing</h2>
            <span className="text-[0.72rem] text-ink-faint">{data.waitingOnBoeing.length} candidates · oldest first</span>
          </div>
          <p className="mb-4 text-[0.75rem] text-ink-faint">Resumes to review and interviews without feedback yet</p>
          <ul className="max-h-[300px] divide-y divide-dashed divide-line overflow-y-auto pr-1">
            {data.waitingOnBoeing.map((s) => {
              const since = s.interviewAt && s.interviewAt <= now ? s.interviewAt : s.sentAt;
              const days = daysSince(since, now);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-[0.85rem] font-semibold">{s.candidateName}</div>
                    <div className="truncate text-[0.72rem] text-ink-faint">
                      {s.positionTitle} · {s.positionLocation} · {s.engagementName}
                    </div>
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <StagePill stage={s.stage} />
                    <span className={`w-10 text-right text-[0.72rem] tabular-nums ${days > 14 ? "font-bold text-ink" : "text-ink-soft"}`}>
                      {days}d
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
          {data.waitingOnObjectways.length > 0 && (
            <div className="mt-4 border-t border-dashed border-line pt-3 text-[0.75rem]">
              <span className="uppercase tracking-wider text-ink-faint">Waiting on Objectways: </span>
              {data.waitingOnObjectways.map((s) => `${s.candidateName} (${STAGE_META[s.stage].label.toLowerCase()} → onboarding)`).join(", ")}
            </div>
          )}
        </section>
      </div>

      <section className="mt-8 rounded-md border border-line bg-card p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[1.05rem]">Positions</h2>
          <span className="text-[0.72rem] text-ink-faint">
            {totals.open} open · {totals.filled} filled · {totals.required} requested
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Engagement", "Role", "Loc.", "Boeing reviewer", "Headcount", "Resumes", "In process", "Onboarded", "Status"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => {
                const inProcess = p.submissions.filter((s) => IN_INTERVIEW_STAGES.includes(s.stage as never) || s.stage === "submitted").length;
                const onboarded = p.submissions.filter((s) => s.stage === "onboarded").length;
                const open = p.filled < p.required;
                return (
                  <tr key={p.id} className="hover:bg-paper-alt">
                    <td className={`${td} text-ink-soft`}>
                      {p.engagementName}
                      <div className="text-[0.7rem] text-ink-faint">POC {p.boeingPoc}</div>
                    </td>
                    <td className={`${td} font-semibold`}>
                      <Link href={`/submissions?engagement=${p.engagementCode}&location=${p.location}`} className="hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className={td}>{p.location}</td>
                    <td className={`${td} text-ink-soft`}>{p.hiringManager ?? "—"}</td>
                    <td className={td}>
                      <div className="flex items-center gap-2">
                        <span className="w-10 tabular-nums">
                          {p.filled}/{p.required}
                        </span>
                        <span className="flex gap-[2px]" aria-hidden>
                          {Array.from({ length: p.required }, (_, i) => (
                            <span key={i} className={`h-2.5 w-4 rounded-sm ${i < p.filled ? "bg-bar" : "bg-track"}`} />
                          ))}
                        </span>
                      </div>
                    </td>
                    <td className={`${td} tabular-nums`}>{p.submissions.length}</td>
                    <td className={`${td} tabular-nums`}>{inProcess}</td>
                    <td className={`${td} tabular-nums`}>{onboarded}</td>
                    <td className={td}>
                      <OpenClosedPill open={open} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-8 rounded-md border border-line bg-card p-6">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[1.05rem]">Latest candidate activity</h2>
          <Link href={`/submissions${qs ? `?${qs}` : ""}`} className="text-[0.72rem] uppercase tracking-wider text-signal-ink hover:underline">
            All {totals.resumesSent} candidates →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-[0.82rem]">
            <thead>
              <tr>
                {["Candidate", "Role", "Sent", "Interview", "Interviewer", "Status"].map((h) => (
                  <th key={h} className={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...data.submissions]
                .sort((a, b) => ((b.interviewAt ?? b.sentAt).getTime() - (a.interviewAt ?? a.sentAt).getTime()))
                .slice(0, 8)
                .map((s) => (
                  <tr key={s.id}>
                    <td className={`${td} font-semibold`}>{s.candidateName}</td>
                    <td className={`${td} text-ink-soft`}>
                      {s.positionTitle} · {s.positionLocation}
                    </td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-ink-soft`}>{formatDate(s.sentAt)}</td>
                    <td className={`${td} whitespace-nowrap tabular-nums text-ink-soft`}>{formatDate(s.interviewAt)}</td>
                    <td className={`${td} text-ink-soft`}>{s.interviewer ?? "—"}</td>
                    <td className={td}>
                      <StagePill stage={s.stage} />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function pct(a: number, b: number) {
  return b ? Math.round((a / b) * 100) : 0;
}

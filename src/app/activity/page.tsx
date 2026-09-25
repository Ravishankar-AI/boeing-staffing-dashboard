import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activity — Objectways Talent" };

const ACTIONS: Record<string, { label: string; glyph: string; tone: string }> = {
  sign_in: { label: "Signed in", glyph: "→", tone: "text-info" },
  sign_out: { label: "Signed out", glyph: "←", tone: "text-muted" },
  sign_in_failed: { label: "Failed sign-in", glyph: "!", tone: "text-critical" },
  register: { label: "Requested an account", glyph: "+", tone: "text-warning" },
  approve: { label: "Approved", glyph: "✓", tone: "text-good" },
  reject: { label: "Rejected request", glyph: "✕", tone: "text-critical" },
  disable: { label: "Disabled account", glyph: "–", tone: "text-critical" },
  enable: { label: "Re-enabled account", glyph: "●", tone: "text-good" },
  role_change: { label: "Changed role", glyph: "⇄", tone: "text-info" },
  stage_change: { label: "Updated candidate", glyph: "◑", tone: "text-info" },
  submission_create: { label: "Added resume", glyph: "+", tone: "text-good" },
  position_update: { label: "Updated opening", glyph: "✎", tone: "text-info" },
  position_create: { label: "Added opening", glyph: "+", tone: "text-good" },
};

const GROUPS: Record<string, string[]> = {
  all: [],
  pipeline: ["stage_change", "submission_create", "position_update", "position_create"],
  access: ["sign_in", "sign_out", "sign_in_failed"],
  accounts: ["register", "approve", "reject", "disable", "enable", "role_change"],
};

const TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ group?: string; user?: string }> }) {
  if (!(await requireRole("admin"))) redirect("/");
  const { group = "all", user } = await searchParams;
  const actions = GROUPS[group] ?? [];

  const [rows, people, since] = await Promise.all([
    prisma.activityLog.findMany({
      where: { ...(actions.length ? { action: { in: actions } } : {}), ...(user ? { userId: user } : {}) },
      include: { user: { select: { role: true, company: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
    prisma.user.findMany({ where: { status: { not: "pending" } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.activityLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      _count: true,
    }),
  ]);
  const week = Object.fromEntries(since.map((r) => [r.action, r._count]));
  const tab = (g: string) => `/activity?group=${g}${user ? `&user=${user}` : ""}`;

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Activity</h1>
      <p className="mb-6 text-[0.85rem] text-ink-soft">Who signed in and what changed, newest first.</p>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-4">
        {[
          ["Sign-ins", week.sign_in ?? 0],
          ["Candidate updates", (week.stage_change ?? 0) + (week.submission_create ?? 0)],
          ["Account requests", week.register ?? 0],
          ["Failed sign-ins", week.sign_in_failed ?? 0],
        ].map(([label, n]) => (
          <div key={label} className="bg-card p-4">
            <div className="text-[0.64rem] uppercase tracking-wider text-ink-faint">{label} · 7 days</div>
            <div className="mt-1 font-display text-[1.6rem] font-extrabold tabular-nums">{n}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex flex-wrap gap-2 text-[0.7rem] uppercase tracking-wider">
          {Object.keys(GROUPS).map((g) => (
            <Link
              key={g}
              href={tab(g)}
              aria-current={g === group ? "page" : undefined}
              className={`rounded-pill border px-3 py-1.5 ${g === group ? "border-line-strong bg-line-strong text-paper" : "border-line text-ink-soft hover:text-ink"}`}
            >
              {g === "all" ? "Everything" : g === "pipeline" ? "Candidates & openings" : g === "access" ? "Sign-ins" : "Accounts"}
            </Link>
          ))}
        </nav>
        <form method="get" action="/activity" className="flex items-center gap-2">
          <input type="hidden" name="group" value={group} />
          <select name="user" defaultValue={user ?? ""} aria-label="Person" className="rounded-md border border-line bg-card px-3 py-1.5 font-mono text-[0.76rem] text-ink">
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button type="submit" className="text-[0.7rem] uppercase tracking-wider text-signal-ink hover:underline">
            Filter
          </button>
        </form>
      </div>

      <ol className="rounded-md border border-line bg-card">
        {rows.length === 0 && <li className="p-6 text-[0.82rem] text-ink-faint">Nothing recorded yet.</li>}
        {rows.map((r) => {
          const meta = ACTIONS[r.action] ?? { label: r.action, glyph: "·", tone: "text-muted" };
          return (
            <li key={r.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-dashed border-line px-5 py-3 text-[0.82rem] last:border-b-0">
              <span className={`w-4 font-bold ${meta.tone}`} aria-hidden>
                {meta.glyph}
              </span>
              <span className="font-semibold">{r.actor}</span>
              {r.user && <span className="text-[0.7rem] text-ink-faint">{r.user.company}</span>}
              <span className="text-ink-soft">{meta.label}</span>
              {r.detail && <span className="min-w-0 basis-full pl-7 text-[0.76rem] text-ink-soft sm:basis-auto sm:pl-0">{r.detail}</span>}
              <time dateTime={r.createdAt.toISOString()} className="ml-auto whitespace-nowrap text-[0.72rem] tabular-nums text-ink-faint">
                {TIME.format(r.createdAt)}
              </time>
            </li>
          );
        })}
      </ol>
      {rows.length === 300 && <p className="mt-3 text-[0.72rem] text-ink-faint">Showing the latest 300 events.</p>}
    </div>
  );
}

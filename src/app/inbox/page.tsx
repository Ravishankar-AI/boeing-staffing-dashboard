import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { formatSize } from "@/lib/resumes";
import { graphConfigured, mailbox } from "@/lib/graph";
import { inboxConfigured, lastSync } from "@/lib/inbox";
import { listPositionGroups } from "@/lib/staffing";
import { checkInboxNow, confirmDraft, dismissDraft, retryEmail } from "@/app/actions";
import { PendingButton } from "@/components/pending-button";
import { AutoRefresh } from "@/components/auto-refresh";

export const dynamic = "force-dynamic";
export const metadata = { title: "Inbox — Objectways Talent" };

const field = "rounded-md border border-line bg-card px-2.5 py-1.5 font-mono text-[0.8rem] text-ink focus:border-signal focus:outline-none";
const stacked = "flex flex-col gap-1 text-[0.64rem] uppercase tracking-wider text-ink-faint";
const primary =
  "rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90";
const ghost = "rounded-pill border border-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-ink hover:bg-paper-alt";

const TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Los_Angeles",
  timeZoneName: "short",
});

export default async function InboxPage() {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const [sync, groups, pendingEmails, failed, recent] = await Promise.all([
    lastSync(),
    listPositionGroups(),
    prisma.inboundEmail.findMany({
      where: { drafts: { some: { status: "pending" } } },
      orderBy: { receivedAt: "asc" },
      include: {
        attachments: { select: { id: true, filename: true, size: true } },
        drafts: { where: { status: "pending" }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.inboundEmail.findMany({ where: { status: "error" }, orderBy: { receivedAt: "desc" } }),
    prisma.inboundEmail.findMany({
      where: { status: { in: ["done", "no_profiles"] } },
      orderBy: { receivedAt: "desc" },
      take: 15,
      include: { drafts: { where: { status: { not: "pending" } }, select: { candidateName: true, status: true } } },
    }),
  ]);
  const ready = inboxConfigured();
  const draftCount = pendingEmails.reduce((n, e) => n + e.drafts.length, 0);

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8">
      <AutoRefresh />
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[2rem]">Inbox</h1>
          <p className="max-w-[75ch] text-[0.85rem] text-ink-soft">
            Profiles emailed to Boeing with <b>{mailbox()}</b> in copy. Claude drafts a candidate for each profile; check
            the details and <b>Confirm</b> to add it. Nothing here is visible to Boeing until it&apos;s confirmed.
          </p>
        </div>
        {ready && (
          <PendingButton action={checkInboxNow} busy="Checking…" className={primary}>
            ↻ Check now
          </PendingButton>
        )}
      </div>

      <div className="mb-8 mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-card px-4 py-3 text-[0.78rem]">
        {!ready ? (
          <span>
            <span className="font-bold text-warning" aria-hidden>
              ○
            </span>{" "}
            Not connected yet: {graphConfigured() ? "the Anthropic API key is missing." : "Microsoft 365 access isn't set up."} See
            the README for setup.
          </span>
        ) : sync ? (
          <>
            <span>
              <span className={`font-bold ${sync.ok ? "text-good" : "text-critical"}`} aria-hidden>
                {sync.ok ? "●" : "✕"}
              </span>{" "}
              Last checked {TIME.format(new Date(sync.at))}: {sync.message}
            </span>
            <span className="text-ink-faint">Checks automatically every 10 minutes.</span>
          </>
        ) : (
          <span className="text-ink-soft">Connected. Not checked yet.</span>
        )}
      </div>

      <h2 className="mb-3 text-[1.15rem]">
        To review · {draftCount} {draftCount === 1 ? "candidate" : "candidates"}
      </h2>
      {pendingEmails.length === 0 && (
        <p className="mb-8 rounded-md border border-dashed border-line p-6 text-[0.85rem] text-ink-faint">Nothing to review.</p>
      )}

      {pendingEmails.map((e) => (
        <section key={e.id} className="mb-6 rounded-md border border-line bg-card p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-[1rem]">{e.subject}</h3>
              <p className="text-[0.74rem] text-ink-soft">
                From {e.fromName ?? e.fromAddress} · to {e.recipients || "—"}
              </p>
              {e.summary && <p className="mt-1 text-[0.76rem] text-ink-soft">{e.summary}</p>}
            </div>
            <time className="whitespace-nowrap text-[0.72rem] text-ink-faint">{TIME.format(e.receivedAt)}</time>
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.74rem]">
            {e.attachments.map((a) => (
              <a key={a.id} href={`/inbox/attachments/${a.id}`} className="rounded-pill border border-line px-2.5 py-0.5 text-signal-ink hover:underline">
                ↓ {a.filename} <span className="text-ink-faint">{formatSize(a.size)}</span>
              </a>
            ))}
            <details className="w-full">
              <summary className="cursor-pointer text-[0.7rem] uppercase tracking-wider text-ink-faint hover:text-ink">Show email</summary>
              <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-paper p-3 font-mono text-[0.74rem] text-ink-soft">
                {e.bodyText}
              </pre>
            </details>
          </div>

          <div className="flex flex-col divide-y divide-dashed divide-line">
            {e.drafts.map((d) => (
              <div key={d.id} className="py-4">
                {d.note && <p className="mb-2 text-[0.74rem] text-ink-soft">{d.note}</p>}
                <form action={confirmDraft} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={d.id} />
                  <label className={stacked}>
                    Candidate name
                    <input name="candidateName" required defaultValue={d.candidateName} className={`${field} w-48`} />
                  </label>
                  <label className={stacked}>
                    Position {d.positionId ? "" : "· choose one"}
                    <select name="positionId" required defaultValue={d.positionId ?? ""} className={`${field} w-72`}>
                      <option value="" disabled>
                        Choose a position…
                      </option>
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
                  <label className={stacked}>
                    Sent to Boeing
                    <input type="date" name="sentAt" required defaultValue={e.receivedAt.toISOString().slice(0, 10)} className={field} />
                  </label>
                  <label className={stacked}>
                    Resume
                    <select name="attachmentId" defaultValue={d.attachmentId ?? ""} className={`${field} w-48`}>
                      <option value="">No resume</option>
                      {e.attachments.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.filename}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className={primary}>
                    ✓ Confirm
                  </button>
                </form>
                <form action={dismissDraft} className="mt-2">
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" className="text-[0.68rem] uppercase tracking-wider text-ink-faint hover:text-ink">
                    Dismiss — not a new candidate
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
      ))}

      {failed.length > 0 && (
        <section className="mb-8 rounded-md border border-line bg-card p-5">
          <h2 className="mb-3 text-[1.05rem]">Couldn&apos;t read · {failed.length}</h2>
          <ul className="flex flex-col divide-y divide-dashed divide-line text-[0.8rem]">
            {failed.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="font-semibold">{e.subject}</div>
                  <div className="text-[0.72rem] text-ink-soft">
                    <span className="font-bold text-critical" aria-hidden>
                      ✕
                    </span>{" "}
                    {e.error} · {formatDate(e.receivedAt)}
                  </div>
                </div>
                <form action={retryEmail}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className={ghost}>
                    Retry
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-md border border-line bg-card p-5">
        <h2 className="mb-3 text-[1.05rem]">Recently handled</h2>
        {recent.length === 0 && <p className="text-[0.8rem] text-ink-faint">Nothing yet.</p>}
        <ul className="flex flex-col divide-y divide-dashed divide-line text-[0.8rem]">
          {recent.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2">
              <span className="min-w-0">
                <span className="font-semibold">{e.subject}</span>{" "}
                <span className="text-ink-soft">
                  ·{" "}
                  {e.status === "no_profiles"
                    ? "no profiles in this email"
                    : e.drafts.map((d) => `${d.candidateName} ${d.status === "confirmed" ? "✓ added" : "– dismissed"}`).join(", ")}
                </span>
              </span>
              <time className="whitespace-nowrap text-[0.72rem] text-ink-faint">{formatDate(e.receivedAt)}</time>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

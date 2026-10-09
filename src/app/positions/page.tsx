import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OPENING_META, openingState } from "@/lib/staffing";
import { createEngagement, createPosition, deleteEngagement, updateEngagement, updatePosition } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { OpeningPill } from "@/components/opening-pill";
import { SaveForm } from "@/components/save-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Openings — Objectways Talent" };

const field = "rounded-md border border-line bg-card px-2 py-1.5 font-mono text-[0.78rem] text-ink focus:border-signal focus:outline-none";
const small = "flex items-center gap-1.5 text-[0.7rem] text-ink-faint";

const primary =
  "rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90";

export default async function PositionsPage({ searchParams }: { searchParams: Promise<{ engagement?: string }> }) {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const { engagement: selected } = await searchParams;
  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "asc" },
    include: { positions: true },
  });

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-8">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[2rem]">Openings</h1>
        <details className="group w-full rounded-md sm:w-auto open:border open:border-dashed open:border-line-strong open:bg-card open:p-5 sm:open:min-w-[420px]">
          <summary className={`${primary} inline-block cursor-pointer list-none group-open:mb-4`}>＋ New engagement</summary>
          <form action={createEngagement} className="flex flex-col gap-3 text-[0.82rem]">
            <p className="text-[0.75rem] text-ink-soft">
              A new Boeing request or change order with its own point of contact. You can add its openings next.
            </p>
            <label className="flex flex-col gap-1 text-[0.66rem] uppercase tracking-wider text-ink-faint">
              Engagement name
              <input name="name" required placeholder="e.g. CR05 · Navneet" className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[0.66rem] uppercase tracking-wider text-ink-faint">
              Boeing point of contact
              <input name="boeingPoc" required placeholder="e.g. Navneet" className={field} />
            </label>
            <button type="submit" className={`${primary} self-start`}>
              Create engagement
            </button>
          </form>
        </details>
      </div>
      <p className="mb-8 max-w-[75ch] text-[0.85rem] text-ink-soft">
        Set an opening to <b>On hold</b> when Boeing pauses it, or <b>Closed</b> if they cancel it. It shows as{" "}
        <b>Filled</b> automatically once filled reaches required. Only open openings count toward Open positions on the
        dashboard.
      </p>

      {engagements.map((e) => {
        const positions = e.positions
          .map((p) => ({ ...p, state: openingState(p) }))
          .sort((a, b) => OPENING_META[a.state].order - OPENING_META[b.state].order || a.title.localeCompare(b.title));
        return (
          <section
            key={e.id}
            id={`eng-${e.id}`}
            className={`mb-6 scroll-mt-24 rounded-md border bg-card p-6 ${e.id === selected ? "border-line-strong" : "border-line"}`}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.05rem]">{e.name}</h2>
                <p className="text-[0.72rem] text-ink-faint">
                  Boeing POC {e.boeingPoc} · {e.positions.length} {e.positions.length === 1 ? "opening" : "openings"}
                </p>
              </div>
              <details className="group">
                <summary className="cursor-pointer list-none text-[0.7rem] uppercase tracking-wider text-signal-ink hover:underline">
                  ✎ Edit engagement
                </summary>
                <SaveForm action={updateEngagement} className="mt-3 flex flex-wrap items-center gap-2 text-[0.8rem]">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="name" required defaultValue={e.name} aria-label="Engagement name" className={`${field} w-48`} />
                  <input name="boeingPoc" required defaultValue={e.boeingPoc} aria-label="Boeing POC" className={`${field} w-40`} />
                </SaveForm>
              </details>
            </div>
            {positions.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-line p-4 text-[0.82rem] text-ink-soft">
                <span>
                  No openings yet.{" "}
                  <a href={`/positions?engagement=${e.id}#add-opening`} className="text-signal-ink underline">
                    Add the first opening
                  </a>{" "}
                  below.
                </span>
                <DeleteButton action={deleteEngagement} id={e.id} confirmText={`Delete the engagement "${e.name}"? It has no openings.`}>
                  Delete engagement
                </DeleteButton>
              </div>
            )}
            <div className="flex flex-col divide-y divide-dashed divide-line">
              {positions.map((p) => (
                <SaveForm key={p.id} action={updatePosition} className="flex flex-wrap items-center gap-3 py-3 text-[0.82rem]">
                  <input type="hidden" name="id" value={p.id} />
                  <span className="flex w-52 flex-col items-start gap-1">
                    <span>
                      <span className="font-semibold">{p.title}</span> <span className="text-ink-faint">· {p.location}</span>
                    </span>
                    <OpeningPill state={p.state} />
                  </span>
                  <label className={small}>
                    Status
                    <select name="status" defaultValue={p.status} className={field}>
                      <option value="open">Open</option>
                      <option value="on_hold">On hold</option>
                      <option value="closed">Closed (cancelled)</option>
                    </select>
                  </label>
                  <label className={small}>
                    Required
                    <input type="number" min={1} name="required" defaultValue={p.required} className={`${field} w-16`} />
                  </label>
                  <label className={small}>
                    Filled
                    <input type="number" min={0} name="filled" defaultValue={p.filled} className={`${field} w-16`} />
                  </label>
                  <input
                    name="hiringManager"
                    defaultValue={p.hiringManager ?? ""}
                    placeholder="Boeing reviewer"
                    aria-label="Boeing reviewer"
                    className={`${field} w-32`}
                  />
                </SaveForm>
              ))}
            </div>
          </section>
        );
      })}

      <form
        id="add-opening"
        action={createPosition}
        className="flex scroll-mt-24 flex-wrap items-end gap-3 rounded-md border border-dashed border-line-strong p-6 text-[0.82rem]"
      >
        <h2 className="w-full text-[1.05rem]">New opening from Boeing</h2>
        <select name="engagementId" aria-label="Engagement" defaultValue={selected} className={field}>
          {engagements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input name="title" required placeholder="Job title" aria-label="Job title" className={field} />
        <select name="location" aria-label="Location" className={field}>
          <option>US</option>
          <option>India</option>
        </select>
        <label className={small}>
          Required
          <input type="number" min={1} name="required" defaultValue={1} className={`${field} w-16`} />
        </label>
        <input name="hiringManager" placeholder="Boeing reviewer" aria-label="Boeing reviewer" className={field} />
        <button
          type="submit"
          className="rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90"
        >
          Add opening
        </button>
      </form>
    </div>
  );
}

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OPENING_META, openingState } from "@/lib/staffing";
import { createPosition, updatePosition } from "@/app/actions";
import { OpeningPill } from "@/components/opening-pill";
import { SaveForm } from "@/components/save-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Openings — Objectways Talent" };

const field = "rounded-md border border-line bg-card px-2 py-1.5 font-mono text-[0.78rem] text-ink focus:border-signal focus:outline-none";
const small = "flex items-center gap-1.5 text-[0.7rem] text-ink-faint";

export default async function PositionsPage() {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "asc" },
    include: { positions: true },
  });

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Openings</h1>
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
          <section key={e.id} className="mb-6 rounded-md border border-line bg-card p-6">
            <h2 className="text-[1.05rem]">{e.name}</h2>
            <p className="mb-4 text-[0.72rem] text-ink-faint">Boeing POC {e.boeingPoc}</p>
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

      <form action={createPosition} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-line-strong p-6 text-[0.82rem]">
        <h2 className="w-full text-[1.05rem]">New opening from Boeing</h2>
        <select name="engagementId" aria-label="Engagement" className={field}>
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

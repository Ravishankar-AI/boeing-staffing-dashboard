import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createPosition, updatePosition } from "@/app/actions";
import { OpenClosedPill } from "@/components/stage-pill";

export const dynamic = "force-dynamic";
export const metadata = { title: "Openings — Boeing Staffing" };

const field = "rounded-md border border-line bg-card px-2 py-1.5 font-mono text-[0.78rem] text-ink focus:border-signal focus:outline-none";

export default async function PositionsPage() {
  if (!(await requireRole("admin"))) redirect("/");
  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "asc" },
    include: { positions: { orderBy: [{ location: "desc" }, { title: "asc" }] } },
  });

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Openings</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">
        Update headcount as Boeing opens or fills roles. A role closes automatically when filled reaches required.
      </p>

      {engagements.map((e) => (
        <section key={e.id} className="mb-6 rounded-md border border-line bg-card p-6">
          <h2 className="text-[1.05rem]">{e.name}</h2>
          <p className="mb-4 text-[0.72rem] text-ink-faint">Boeing POC {e.boeingPoc}</p>
          <div className="flex flex-col divide-y divide-dashed divide-line">
            {e.positions.map((p) => (
              <form key={p.id} action={updatePosition} className="flex flex-wrap items-center gap-3 py-3 text-[0.82rem]">
                <input type="hidden" name="id" value={p.id} />
                <span className="w-56 font-semibold">
                  {p.title} <span className="font-normal text-ink-faint">· {p.location}</span>
                </span>
                <label className="flex items-center gap-1.5 text-[0.7rem] text-ink-faint">
                  Required
                  <input type="number" min={0} name="required" defaultValue={p.required} className={`${field} w-16`} />
                </label>
                <label className="flex items-center gap-1.5 text-[0.7rem] text-ink-faint">
                  Filled
                  <input type="number" min={0} name="filled" defaultValue={p.filled} className={`${field} w-16`} />
                </label>
                <input name="hiringManager" defaultValue={p.hiringManager ?? ""} placeholder="Boeing reviewer" className={`${field} w-40`} />
                <OpenClosedPill open={p.filled < p.required} />
                <button type="submit" className="ml-auto text-[0.7rem] uppercase tracking-wider text-signal-ink hover:underline">
                  Save
                </button>
              </form>
            ))}
          </div>
        </section>
      ))}

      <form action={createPosition} className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-line-strong p-6 text-[0.82rem]">
        <h2 className="w-full text-[1.05rem]">New opening from Boeing</h2>
        <select name="engagementId" className={field}>
          {engagements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
        <input name="title" required placeholder="Job title" className={field} />
        <select name="location" className={field}>
          <option>US</option>
          <option>India</option>
        </select>
        <input type="number" min={1} name="required" defaultValue={1} className={`${field} w-16`} />
        <input name="hiringManager" placeholder="Boeing reviewer" className={field} />
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

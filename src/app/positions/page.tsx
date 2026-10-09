import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OPENING_META, effectiveFilled, openingState } from "@/lib/staffing";
import { createChangeRequest, createPosition, deleteChangeRequest, updateChangeRequest, updatePosition } from "@/app/actions";
import { DeleteButton } from "@/components/delete-button";
import { OpeningPill } from "@/components/opening-pill";
import { SaveForm } from "@/components/save-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Openings — Objectways Talent" };

const field = "rounded-md border border-line bg-card px-2 py-1.5 font-mono text-[0.78rem] text-ink focus:border-signal focus:outline-none";
const small = "flex items-center gap-1.5 text-[0.7rem] text-ink-faint";
const stacked = "flex flex-col gap-1 text-[0.66rem] uppercase tracking-wider text-ink-faint";
const primary =
  "rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90";

const ERRORS: Record<string, (code?: string) => string> = {
  cr_exists: (code) => `A change request called ${code ?? "that"} already exists. Add openings or owners to it instead.`,
  cr_code: () => "Give the change request a code, e.g. CR05.",
};

type Owner = { id: string; name: string };

/** Owners already on this CR first, then everyone else (picking one of those
 * adds them to the CR). */
function OwnerSelect({ value, crOwners, allOwners }: { value?: string | null; crOwners: Owner[]; allOwners: Owner[] }) {
  const onCr = new Set(crOwners.map((o) => o.id));
  const others = allOwners.filter((o) => !onCr.has(o.id));
  return (
    <select name="businessOwnerId" defaultValue={value ?? ""} aria-label="Business owner" className={`${field} w-32`}>
      <option value="">— No owner —</option>
      {crOwners.length > 0 && (
        <optgroup label="On this CR">
          {crOwners.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </optgroup>
      )}
      {others.length > 0 && (
        <optgroup label="Other owners">
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

export default async function PositionsPage({ searchParams }: { searchParams: Promise<{ cr?: string; error?: string; code?: string }> }) {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const { cr: selected, error, code } = await searchParams;
  const [crs, allOwners] = await Promise.all([
    prisma.changeRequest.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        owners: { include: { owner: true }, orderBy: { owner: { name: "asc" } } },
        positions: { include: { _count: { select: { submissions: { where: { stage: "onboarded" } } } } } },
      },
    }),
    prisma.businessOwner.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-8">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[2rem]">Openings</h1>
        <details
          open={!!error}
          className="group w-full rounded-md sm:w-auto open:border open:border-dashed open:border-line-strong open:bg-card open:p-5 sm:open:min-w-[440px]"
        >
          <summary className={`${primary} inline-block cursor-pointer list-none group-open:mb-4`}>＋ New change request</summary>
          <form action={createChangeRequest} className="flex flex-col gap-3 text-[0.82rem]">
            <p className="text-[0.75rem] text-ink-soft">
              A Boeing change request with one or more business owners. You can add its openings next.
            </p>
            <label className={stacked}>
              CR code
              <input name="code" required defaultValue={code} placeholder="e.g. CR05" className={field} />
            </label>
            <label className={stacked}>
              Description (optional)
              <input name="title" placeholder="e.g. Data platform expansion" className={field} />
            </label>
            <label className={stacked}>
              Business owners
              <input name="owners" placeholder="e.g. Lakshmi, Christos" list="owner-names" className={field} />
              <span className="normal-case tracking-normal text-[0.72rem]">
                Separate names with commas. Existing owners are reused; new names are added.
              </span>
            </label>
            {error && ERRORS[error] && (
              <p role="alert" className="flex items-center gap-2 text-[0.8rem] text-ink">
                <span className="font-bold text-critical" aria-hidden>
                  ✕
                </span>
                {ERRORS[error](code)}
              </p>
            )}
            <button type="submit" className={`${primary} self-start`}>
              Create change request
            </button>
          </form>
        </details>
      </div>
      <datalist id="owner-names">
        {allOwners.map((o) => (
          <option key={o.id} value={o.name} />
        ))}
      </datalist>
      <p className="mb-8 max-w-[80ch] text-[0.85rem] text-ink-soft">
        Each opening belongs to a change request and a business owner. Set it to <b>On hold</b> when Boeing pauses it, or{" "}
        <b>Closed</b> if they cancel it. <b>Filled</b> counts candidates marked Onboarded automatically; type a higher
        number for hires made outside this app.
      </p>

      {crs.map((cr) => {
        const crOwners = cr.owners.map((o) => o.owner);
        const positions = cr.positions
          .map((p) => {
            const onboarded = p._count.submissions;
            return { ...p, onboarded, state: openingState({ ...p, filled: effectiveFilled(p, onboarded) }) };
          })
          .sort((a, b) => OPENING_META[a.state].order - OPENING_META[b.state].order || a.title.localeCompare(b.title));
        return (
          <section
            key={cr.id}
            id={`cr-${cr.id}`}
            className={`mb-6 scroll-mt-24 rounded-md border bg-card p-6 ${cr.id === selected ? "border-line-strong" : "border-line"}`}
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[1.05rem]">
                  {cr.code}
                  {cr.title && <span className="ml-2 font-mono text-[0.78rem] font-normal text-ink-soft">{cr.title}</span>}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-ink-faint">
                  <span>Business owners:</span>
                  {crOwners.length ? (
                    crOwners.map((o) => (
                      <span key={o.id} className="rounded-pill border border-line px-2 py-0.5 text-ink">
                        {o.name}
                      </span>
                    ))
                  ) : (
                    <span>none yet</span>
                  )}
                  <span>
                    · {cr.positions.length} {cr.positions.length === 1 ? "opening" : "openings"}
                  </span>
                </div>
              </div>
              <details className="group">
                <summary className="cursor-pointer list-none text-right text-[0.7rem] uppercase tracking-wider text-signal-ink hover:underline">
                  ✎ Edit change request
                </summary>
                <SaveForm action={updateChangeRequest} className="mt-3 flex flex-wrap items-end gap-2 text-[0.8rem]">
                  <input type="hidden" name="id" value={cr.id} />
                  <label className={stacked}>
                    Code
                    <input name="code" required defaultValue={cr.code} className={`${field} w-28`} />
                  </label>
                  <label className={stacked}>
                    Description
                    <input name="title" defaultValue={cr.title ?? ""} className={`${field} w-48`} />
                  </label>
                  <label className={stacked}>
                    Business owners
                    <input
                      name="owners"
                      defaultValue={crOwners.map((o) => o.name).join(", ")}
                      list="owner-names"
                      className={`${field} w-56`}
                    />
                  </label>
                </SaveForm>
              </details>
            </div>
            {positions.length === 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-line p-4 text-[0.82rem] text-ink-soft">
                <span>
                  No openings yet.{" "}
                  <a href={`/positions?cr=${cr.id}#add-opening`} className="text-signal-ink underline">
                    Add the first opening
                  </a>{" "}
                  below.
                </span>
                <DeleteButton action={deleteChangeRequest} id={cr.id} confirmText={`Delete change request ${cr.code}? It has no openings.`}>
                  Delete change request
                </DeleteButton>
              </div>
            )}
            <div className="flex flex-col divide-y divide-dashed divide-line">
              {positions.map((p) => (
                <SaveForm key={p.id} action={updatePosition} className="flex flex-wrap items-center gap-3 py-3 text-[0.82rem]">
                  <input type="hidden" name="id" value={p.id} />
                  <span className="flex w-44 flex-col items-start gap-1">
                    <span>
                      <span className="font-semibold">{p.title}</span> <span className="text-ink-faint">· {p.location}</span>
                    </span>
                    <OpeningPill state={p.state} />
                  </span>
                  <label className={small}>
                    Owner
                    <OwnerSelect value={p.businessOwnerId} crOwners={crOwners} allOwners={allOwners} />
                  </label>
                  <label className={small}>
                    Status
                    <select name="status" defaultValue={p.status} className={`${field} w-28`}>
                      <option value="open">Open</option>
                      <option value="on_hold">On hold</option>
                      <option value="closed">Closed</option>
                    </select>
                  </label>
                  <label className={small}>
                    Req.
                    <input type="number" min={1} name="required" defaultValue={p.required} className={`${field} w-14`} />
                  </label>
                  <label className={small} title="Counts candidates marked Onboarded automatically">
                    Filled
                    <input type="number" min={0} name="filled" defaultValue={p.filled} className={`${field} w-14`} />
                    {p.onboarded > 0 && <span className="text-[0.66rem]">{p.onboarded} onboarded</span>}
                  </label>
                  <input
                    name="hiringManager"
                    defaultValue={p.hiringManager ?? ""}
                    placeholder="Boeing reviewer"
                    aria-label="Boeing reviewer"
                    className={`${field} w-24`}
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
        <label className={stacked}>
          Change request
          <select name="changeRequestId" defaultValue={selected} className={field}>
            {crs.map((cr) => (
              <option key={cr.id} value={cr.id}>
                {cr.code}
              </option>
            ))}
          </select>
        </label>
        <label className={stacked}>
          Business owner
          <select name="businessOwnerId" className={`${field} w-36`}>
            <option value="">— No owner —</option>
            {allOwners.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className={stacked}>
          or new owner
          <input name="newOwner" placeholder="Name" className={`${field} w-28`} />
        </label>
        <label className={stacked}>
          Job title
          <input name="title" required className={field} />
        </label>
        <label className={stacked}>
          Location
          <select name="location" className={field}>
            <option>US</option>
            <option>India</option>
          </select>
        </label>
        <label className={stacked}>
          Required
          <input type="number" min={1} name="required" defaultValue={1} className={`${field} w-16`} />
        </label>
        <label className={stacked}>
          Boeing reviewer
          <input name="hiringManager" className={`${field} w-32`} />
        </label>
        <button type="submit" className={primary}>
          Add opening
        </button>
      </form>
    </div>
  );
}

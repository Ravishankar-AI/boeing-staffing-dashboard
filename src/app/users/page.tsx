import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { approveUser, rejectUser, updateUser } from "@/app/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users — Objectways Talent" };

const ROLE_LABEL = { client: "Client (read-only)", recruiter: "Recruiter", admin: "Admin" } as const;
const field = "rounded-md border border-line bg-card px-2 py-1.5 font-mono text-[0.76rem] text-ink focus:border-signal focus:outline-none";
const th = "border-b-2 border-line-strong pb-3 pr-4 text-left font-mono text-[0.64rem] font-medium uppercase tracking-wider text-ink-faint";
const td = "border-b border-dashed border-line py-3 pr-4 align-middle";
const button = "rounded-pill border border-line-strong px-3 py-1.5 font-mono text-[0.66rem] uppercase tracking-wider";

function RoleSelect({ value }: { value: string }) {
  return (
    <select name="role" defaultValue={value} className={field} aria-label="Role">
      {Object.entries(ROLE_LABEL).map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

export default async function UsersPage() {
  const session = await requireRole("admin");
  if (!session) redirect("/");
  const users = await prisma.user.findMany({ orderBy: [{ createdAt: "desc" }] });
  const pending = users.filter((u) => u.status === "pending");
  const others = users.filter((u) => u.status !== "pending");

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Users</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">
        Approve account requests and choose what each person can see. Disabling someone signs them out immediately.
      </p>

      <section className="mb-8 rounded-md border border-line bg-card p-6">
        <h2 className="mb-1 text-[1.05rem]">Waiting for approval · {pending.length}</h2>
        <p className="mb-4 text-[0.75rem] text-ink-faint">
          The role is pre-filled from what they chose when registering. Check it before approving.
        </p>
        {pending.length === 0 && <p className="text-[0.82rem] text-ink-faint">No requests right now.</p>}
        <ul className="flex flex-col divide-y divide-dashed divide-line">
          {pending.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-3 py-3 text-[0.82rem]">
              <div className="min-w-[240px] flex-1">
                <div className="font-semibold">{u.name}</div>
                <div className="text-[0.74rem] text-ink-soft">
                  {u.email} · {u.company} · requested {formatDate(u.createdAt)}
                </div>
              </div>
              <form action={approveUser} className="flex items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <RoleSelect value={u.role} />
                <button type="submit" className={`${button} bg-line-strong text-paper hover:opacity-90`}>
                  Approve
                </button>
              </form>
              <form action={rejectUser}>
                <input type="hidden" name="id" value={u.id} />
                <button type="submit" className={`${button} text-ink hover:bg-paper-alt`}>
                  Reject
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-x-auto rounded-md border border-line bg-card p-6">
        <h2 className="mb-4 text-[1.05rem]">Accounts · {others.length}</h2>
        <table className="w-full min-w-[820px] border-collapse text-[0.8rem]">
          <thead>
            <tr>
              {["Name", "Company", "Last sign-in", "Role", "Access", ""].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {others.map((u) => {
              const self = u.id === session.userId;
              return (
                <tr key={u.id}>
                  <td className={td}>
                    <div className="font-semibold">
                      {u.name}
                      {self && <span className="ml-2 text-[0.68rem] font-normal text-ink-faint">(you)</span>}
                    </div>
                    <div className="text-[0.72rem] text-ink-soft">{u.email}</div>
                  </td>
                  <td className={`${td} text-ink-soft`}>{u.company}</td>
                  <td className={`${td} whitespace-nowrap text-ink-soft`}>{u.lastLoginAt ? formatDate(u.lastLoginAt) : "Never"}</td>
                  <td className={td} colSpan={3}>
                    <form action={updateUser} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <RoleSelect value={u.role} />
                      <select name="status" defaultValue={u.status} className={field} aria-label="Access" disabled={self}>
                        <option value="active">● Active</option>
                        <option value="disabled">– Disabled</option>
                      </select>
                      {self && <input type="hidden" name="status" value="active" />}
                      <button type="submit" className="ml-auto text-[0.7rem] uppercase tracking-wider text-signal-ink hover:underline">
                        Save
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}

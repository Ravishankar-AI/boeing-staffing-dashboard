import { prisma } from "@/lib/db";
import { signInAs } from "./actions";

export const metadata = { title: "Sign in — Boeing Staffing" };
export const dynamic = "force-dynamic";

const ROLE_NOTE: Record<string, string> = {
  admin: "Objectways leadership. Sees everything; can edit openings and candidate status.",
  recruiter: "Objectways recruiters. Add resumes and move candidates through interview stages.",
  client: "Boeing hiring team. Read-only view of openings, resumes sent, and interview status.",
};

export default async function SignInPage() {
  const users = await prisma.user.findMany({ orderBy: { role: "asc" } });
  return (
    <div className="mx-auto max-w-[640px] px-4 py-16 sm:px-8">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">Mock sign-in — demo only</div>
      <h1 className="mb-4 text-[2rem]">Who&apos;s looking?</h1>
      <p className="mb-10 text-ink-soft">
        Pick a persona to see the dashboard the way Boeing, a recruiter, or leadership would. Real SSO replaces this
        before go-live.
      </p>
      <div className="flex flex-col gap-4">
        {users.map((u) => (
          <form key={u.id} action={signInAs} className="flex items-center justify-between gap-4 border border-line bg-card p-5">
            <input type="hidden" name="email" value={u.email} />
            <div>
              <div className="font-display text-[1rem] font-extrabold">
                {u.name}
                <span className="ml-2 font-mono text-[0.68rem] font-normal uppercase tracking-wider text-signal-ink">
                  {u.role === "client" ? "Boeing" : u.role}
                </span>
              </div>
              <p className="text-[0.8rem] text-ink-soft">{ROLE_NOTE[u.role]}</p>
            </div>
            <button
              type="submit"
              className="rounded-pill border border-line-strong bg-line-strong px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-paper hover:opacity-90"
            >
              Enter
            </button>
          </form>
        ))}
      </div>
    </div>
  );
}

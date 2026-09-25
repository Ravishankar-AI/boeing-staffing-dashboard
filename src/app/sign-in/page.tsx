import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { signIn } from "./actions";

export const metadata = { title: "Sign in — Objectways Talent" };
export const dynamic = "force-dynamic";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getSession()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-[440px] px-4 py-20 sm:px-8">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">Objectways Talent</div>
      <h1 className="mb-3 text-[2rem]">Sign in</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">
        Hiring dashboard for Objectways clients and recruiters. Enter the password you were given.
      </p>
      <form action={signIn} className="flex flex-col gap-4 rounded-md border border-line bg-card p-6">
        <label className="flex flex-col gap-1.5 text-[0.66rem] uppercase tracking-wider text-ink-faint">
          Password
          <input
            type="password"
            name="password"
            required
            autoFocus
            autoComplete="current-password"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "signin-error" : undefined}
            className="rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-[0.9rem] normal-case tracking-normal text-ink focus:border-signal focus:outline-none"
          />
        </label>
        {error && (
          <p id="signin-error" role="alert" className="flex items-center gap-2 text-[0.8rem] text-ink">
            <span className="font-bold text-critical" aria-hidden>
              ✕
            </span>
            That password isn&apos;t right. Check with Objectways if you need access.
          </p>
        )}
        <button
          type="submit"
          className="rounded-pill border border-line-strong bg-line-strong px-4 py-2.5 font-mono text-[0.72rem] uppercase tracking-wider text-paper hover:opacity-90"
        >
          Sign in
        </button>
      </form>
    </div>
  );
}

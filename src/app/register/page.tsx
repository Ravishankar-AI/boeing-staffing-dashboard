import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwords";
import { AuthShell, Field, Notice, formCard, submitButton } from "@/components/auth-form";
import { register } from "../sign-in/actions";

export const metadata = { title: "Request an account — Objectways Talent" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  fields: "Please fill in your name, a valid work email, and your company.",
  short: `Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`,
  mismatch: "The two passwords don't match.",
  exists: "An account with that email already exists. Sign in instead, or contact Objectways if you're stuck.",
};

type Params = { error?: string; done?: string; name?: string; email?: string; company?: string; side?: string };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (await getSession()) redirect("/");
  const p = await searchParams;

  if (p.done) {
    return (
      <AuthShell title="Request sent" intro="Thanks — your account has been created and is waiting for approval.">
        <div className={formCard}>
          <Notice tone="ok">
            Objectways will review your request and choose what you can see. Once it&apos;s approved, sign in with the
            email and password you just chose.
          </Notice>
          <Link href="/sign-in" className={`${submitButton} text-center`}>
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Request an account" intro="For Boeing hiring teams and Objectways recruiters. Every request is approved by Objectways before it can see anything.">
      <form action={register} className={formCard}>
        <Field label="Full name" name="name" required autoComplete="name" defaultValue={p.name} autoFocus />
        <Field label="Work email" type="email" name="email" required autoComplete="email" defaultValue={p.email} />
        <Field label="Company" name="company" required autoComplete="organization" defaultValue={p.company} placeholder="e.g. Boeing" />
        <fieldset className="flex flex-col gap-2 text-[0.66rem] uppercase tracking-wider text-ink-faint">
          <legend className="mb-1.5">I am</legend>
          {[
            ["client", "A client hiring manager (e.g. Boeing)"],
            ["objectways", "An Objectways recruiter"],
          ].map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-[0.82rem] normal-case tracking-normal text-ink">
              <input type="radio" name="side" value={value} defaultChecked={(p.side ?? "client") === value} className="accent-[var(--signal)]" />
              {label}
            </label>
          ))}
        </fieldset>
        <Field
          label="Password"
          type="password"
          name="password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          autoComplete="new-password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        />
        <Field label="Confirm password" type="password" name="confirm" required autoComplete="new-password" />
        {p.error && <Notice tone="error">{ERRORS[p.error] ?? ERRORS.fields}</Notice>}
        <button type="submit" className={submitButton}>
          Request account
        </button>
      </form>
      <p className="mt-6 text-center text-[0.8rem] text-ink-soft">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-signal-ink underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

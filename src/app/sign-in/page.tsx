import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AuthShell, Field, Notice, formCard, submitButton } from "@/components/auth-form";
import { signIn } from "./actions";

export const metadata = { title: "Sign in — Objectways Talent" };
export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "That email and password don't match an account.",
  pending: "Your account is waiting for approval from Objectways. You'll be able to sign in once it's approved.",
  disabled: "This account has been disabled. Contact Objectways if you need access.",
};

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string; email?: string }> }) {
  if (await getSession()) redirect("/");
  const { error, email } = await searchParams;
  const message = error ? (ERRORS[error] ?? ERRORS.invalid) : null;

  return (
    <AuthShell title="Sign in" intro="Hiring dashboard for Objectways clients and recruiters.">
      <form action={signIn} className={formCard}>
        <Field label="Email" type="email" name="email" required autoComplete="email" defaultValue={email} autoFocus={!email} />
        <Field label="Password" type="password" name="password" required autoComplete="current-password" autoFocus={!!email} />
        {message && <Notice tone={error === "pending" ? "info" : "error"}>{message}</Notice>}
        <button type="submit" className={submitButton}>
          Sign in
        </button>
      </form>
      <p className="mt-6 text-center text-[0.8rem] text-ink-soft">
        New here?{" "}
        <Link href="/register" className="text-signal-ink underline">
          Request an account
        </Link>
      </p>
    </AuthShell>
  );
}

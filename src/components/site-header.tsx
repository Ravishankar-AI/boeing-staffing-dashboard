import Link from "next/link";
import type { Session } from "@/lib/auth";
import { signOut } from "@/app/sign-in/actions";

export function SiteHeader({ session }: { session: Session | null }) {
  const links = [
    { href: "/", label: "Dashboard" },
    { href: "/submissions", label: "Candidates" },
    ...(session && session.role !== "client" ? [{ href: "/submissions/new", label: "Add resume" }] : []),
    ...(session?.role === "admin" ? [{ href: "/positions", label: "Openings" }] : []),
  ];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center justify-between gap-6 px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Objectways Talent home">
          {/* Official wordmark from objectways.com (2560×373). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/objectways-logo.webp" alt="Objectways" width={165} height={24} className="brand-logo h-6 w-auto" />
          <span className="hidden border-l border-line pl-3 font-mono text-[0.68rem] font-medium uppercase tracking-wider text-ink-faint sm:inline">
            Talent
          </span>
        </Link>

        {session && (
          <nav className="hidden gap-7 text-[0.74rem] uppercase tracking-wider text-ink-soft md:flex">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-4">
          {session && (
            <span className="hidden text-[0.72rem] uppercase tracking-wider text-ink-faint lg:inline">
              {session.name} · {session.role === "client" ? "Boeing" : session.role}
            </span>
          )}
          {session && (
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-pill border border-line-strong bg-line-strong px-3.5 py-2 font-mono text-[0.68rem] uppercase tracking-wider text-paper hover:opacity-90"
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
      {session && (
        <nav className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2.5 text-[0.7rem] uppercase tracking-wider text-ink-soft md:hidden">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="whitespace-nowrap hover:text-ink">
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

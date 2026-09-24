import { cookies } from "next/headers";
import { prisma } from "./db";

/**
 * Mock auth for the mock-up phase: a persona picker at /sign-in stores the
 * chosen email in a cookie and trusts it. Fine for a demo with seeded
 * personas; not fine once real Boeing users log in. To replace, swap
 * getSession()'s cookie read for a real IdP (Auth.js / Clerk / Azure AD for
 * Boeing SSO) and keep the Session shape — the pages only read `role`.
 */

export const SESSION_COOKIE = "boeing_staffing_mock_session";

// admin     — Objectways leadership: everything, including editing openings.
// recruiter — Objectways recruiters: add resumes, move candidates through stages.
// client    — Boeing: read-only view of the same pipeline.
export type Role = "admin" | "recruiter" | "client";

export type Session = {
  userId: string;
  email: string;
  name: string;
  role: Role;
  company: string;
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const email = store.get(SESSION_COOKIE)?.value;
  if (!email) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;

  return { userId: user.id, email: user.email, name: user.name, role: user.role as Role, company: user.company };
}

export async function requireRole(...roles: Role[]) {
  const session = await getSession();
  if (!session || !roles.includes(session.role)) return null;
  return session;
}

export function isStaff(session: Session | null) {
  return session?.role === "admin" || session?.role === "recruiter";
}

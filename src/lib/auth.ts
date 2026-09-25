import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";

/**
 * Password sign-in, one shared password per group:
 *
 *   ADMIN_PASSWORD      → Objectways leadership (admin)
 *   RECRUITER_PASSWORD  → Objectways recruiters (recruiter)
 *   CLIENT_PASSWORD     → Boeing hiring team (client)
 *
 * The password picks the role, and the role maps to that group's seeded user.
 * The session cookie holds the user's email plus an HMAC-SHA256 signature
 * keyed by SESSION_SECRET, so it can't be forged or edited to switch roles.
 * A role whose password env var is unset cannot sign in at all (fails closed).
 *
 * Stopgap until individual accounts / SSO. When replacing it, keep the
 * Session shape — the pages only read `role`.
 */

export const SESSION_COOKIE = "objectways_talent_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

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

const PASSWORD_ENV: Record<Role, string> = {
  admin: "ADMIN_PASSWORD",
  recruiter: "RECRUITER_PASSWORD",
  client: "CLIENT_PASSWORD",
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return s;
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export function encodeSession(email: string) {
  return `${email}.${sign(email)}`;
}

function decodeSession(raw: string | undefined) {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const email = raw.slice(0, dot);
  return safeEqual(raw.slice(dot + 1), sign(email)) ? email : null;
}

/** Which role, if any, this password unlocks. */
export function roleForPassword(password: string): Role | null {
  if (!password) return null;
  for (const role of Object.keys(PASSWORD_ENV) as Role[]) {
    const expected = process.env[PASSWORD_ENV[role]];
    if (expected && safeEqual(password, expected)) return role;
  }
  return null;
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const email = decodeSession(store.get(SESSION_COOKIE)?.value);
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

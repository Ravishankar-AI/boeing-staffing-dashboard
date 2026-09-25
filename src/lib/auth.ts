import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./passwords";

/**
 * Individual accounts: people register at /register, an admin approves them
 * and assigns a role at /users, and they sign in with email + password
 * (scrypt-hashed, src/lib/passwords.ts). Only `status: "active"` users get a
 * session, and it is re-checked on every request, so disabling someone takes
 * effect immediately.
 *
 * The session cookie holds the user's email plus an HMAC-SHA256 signature
 * keyed by SESSION_SECRET, so it can't be forged or edited to switch users.
 *
 * Bootstrap: an admin with no password yet can sign in once with
 * ADMIN_PASSWORD, which then becomes their password. That is how the seeded
 * admin gets in on a fresh database.
 *
 * When moving to SSO, keep the Session shape — the pages only read `role`.
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

/** Returns the active user if the credentials are right, else null. */
export async function authenticate(emailInput: string, password: string) {
  const email = normalizeEmail(emailInput);
  if (!email || !password) return null;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") return null;

  if (await verifyPassword(password, user.passwordHash)) return user;

  const bootstrap = process.env.ADMIN_PASSWORD;
  if (user.role === "admin" && !user.passwordHash && bootstrap && safeEqual(password, bootstrap)) {
    return prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  }
  return null;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const email = decodeSession(store.get(SESSION_COOKIE)?.value);
  if (!email) return null;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || user.status !== "active") return null;

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

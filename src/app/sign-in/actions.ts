"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, authenticate, encodeSession, getSession, normalizeEmail } from "@/lib/auth";
import { MIN_PASSWORD_LENGTH, hashPassword, verifyPassword } from "@/lib/passwords";
import { logActivity } from "@/lib/activity";

// Slow down guessing a little; there is no lockout.
const pause = () => new Promise((r) => setTimeout(r, 800));

export async function signIn(formData: FormData) {
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(email, password);

  if (!user) {
    // Correct password on an account that isn't active yet gets a specific
    // message; anything else gets the generic one.
    const existing = email ? await prisma.user.findUnique({ where: { email } }) : null;
    const known = existing && (await verifyPassword(password, existing.passwordHash));
    await logActivity(
      { id: existing?.id ?? null, name: existing?.name ?? email },
      "sign_in_failed",
      known ? `account is ${existing.status}` : `tried ${email || "(no email)"}`,
    );
    await pause();
    redirect(`/sign-in?error=${known ? existing.status : "invalid"}&email=${encodeURIComponent(email)}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logActivity({ id: user.id, name: user.name }, "sign_in");

  const store = await cookies();
  store.set(SESSION_COOKIE, encodeSession(user.email), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/");
}

export async function register(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const company = String(formData.get("company") ?? "").trim();
  const side = String(formData.get("side") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  const fail = (code: string) =>
    redirect(
      `/register?error=${code}&${new URLSearchParams({ name, email, company, side }).toString()}`,
    );

  if (!name || !company || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("fields");
  if (password.length < MIN_PASSWORD_LENGTH) fail("short");
  if (password !== confirm) fail("mismatch");
  if (await prisma.user.findUnique({ where: { email } })) fail("exists");

  // The requested side is only a suggestion; an admin picks the real role on
  // approval, and nothing is visible until then.
  const user = await prisma.user.create({
    data: {
      name,
      email,
      company,
      role: side === "objectways" ? "recruiter" : "client",
      status: "pending",
      passwordHash: await hashPassword(password),
    },
  });
  await logActivity({ id: user.id, name }, "register", `${email} · ${company}`);
  redirect("/register?done=1");
}

export async function signOut() {
  const session = await getSession();
  if (session) await logActivity(session, "sign_out");
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}

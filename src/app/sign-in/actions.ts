"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, encodeSession, roleForPassword } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const role = roleForPassword(password);
  const user = role ? await prisma.user.findFirst({ where: { role }, orderBy: { createdAt: "asc" } }) : null;

  if (!user) {
    // Slow down guessing a little; there is no lockout.
    await new Promise((r) => setTimeout(r, 800));
    redirect("/sign-in?error=1");
  }

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

export async function signOut() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/sign-in");
}

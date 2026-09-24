"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";

export async function signInAs(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const store = await cookies();
  store.set(SESSION_COOKIE, email, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/");
}

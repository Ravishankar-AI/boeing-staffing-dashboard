import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Objectways Talent",
  description: "Shared view of Boeing openings, resumes sent, and interview status for Boeing, Objectways recruiters, and leadership.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const pendingUsers = session?.role === "admin" ? await prisma.user.count({ where: { status: "pending" } }) : 0;
  const inboxDrafts =
    session && session.role !== "client" ? await prisma.emailDraft.count({ where: { status: "pending" } }) : 0;
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader session={session} pendingUsers={pendingUsers} inboxDrafts={inboxDrafts} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line px-4 py-6 text-center text-[0.72rem] text-ink-faint">
          <p>Copyright © {new Date().getFullYear()} Objectways - All rights reserved.</p>
          <p className="mt-1 text-[0.66rem] uppercase tracking-wider">Objectways Talent · Client hiring dashboard</p>
        </footer>
      </body>
    </html>
  );
}

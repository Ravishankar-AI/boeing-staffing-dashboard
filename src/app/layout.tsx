import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Objectways Talent",
  description: "Shared view of Boeing openings, resumes sent, and interview status for Boeing, Objectways recruiters, and leadership.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <SiteHeader session={session} />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line py-6 text-center text-[0.68rem] uppercase tracking-wider text-ink-faint">
          Objectways Talent · Client hiring dashboard
        </footer>
      </body>
    </html>
  );
}

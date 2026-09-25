import type { ReactNode } from "react";

export function AuthShell({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[460px] px-4 py-16 sm:px-8">
      <div className="mb-2 font-mono text-[0.72rem] uppercase tracking-wider text-ink-faint">Objectways Talent</div>
      <h1 className="mb-3 text-[2rem]">{title}</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">{intro}</p>
      {children}
    </div>
  );
}

export const formCard = "flex flex-col gap-4 rounded-md border border-line bg-card p-6";
export const submitButton =
  "rounded-pill border border-line-strong bg-line-strong px-4 py-2.5 font-mono text-[0.72rem] uppercase tracking-wider text-paper hover:opacity-90";
const inputClass =
  "rounded-md border border-line bg-paper px-3 py-2.5 font-mono text-[0.9rem] normal-case tracking-normal text-ink focus:border-signal focus:outline-none";

export function Field({ label, hint, ...input }: { label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-[0.66rem] uppercase tracking-wider text-ink-faint">
      {label}
      <input {...input} className={inputClass} />
      {hint && <span className="normal-case tracking-normal text-[0.72rem]">{hint}</span>}
    </label>
  );
}

export function Notice({ tone, children }: { tone: "error" | "ok" | "info"; children: ReactNode }) {
  const glyph = { error: "✕", ok: "✓", info: "○" }[tone];
  const color = { error: "text-critical", ok: "text-good", info: "text-info" }[tone];
  return (
    <p role={tone === "error" ? "alert" : "status"} className="flex items-start gap-2 text-[0.8rem] text-ink">
      <span className={`font-bold ${color}`} aria-hidden>
        {glyph}
      </span>
      <span>{children}</span>
    </p>
  );
}

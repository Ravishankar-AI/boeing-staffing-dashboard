"use client";

import { useState, useTransition, type ReactNode } from "react";

/** A form whose Save button reports back ("Saving…", "✓ Saved", or an error)
 * instead of silently re-rendering, so people can tell the change went
 * through. Editing any field clears the "Saved" note. */
export function SaveForm({
  action,
  className,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onChange={() => setState("idle")}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await action(fd);
            setState("saved");
          } catch {
            setState("error");
          }
        });
      }}
    >
      {children}
      <span className="ml-auto flex items-center gap-2">
        <span role="status" className="min-w-[4.5rem] text-right text-[0.72rem]">
          {state === "saved" && (
            <>
              <span className="font-bold text-good" aria-hidden>
                ✓
              </span>{" "}
              Saved
            </>
          )}
          {state === "error" && (
            <>
              <span className="font-bold text-critical" aria-hidden>
                ✕
              </span>{" "}
              Couldn&apos;t save
            </>
          )}
        </span>
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill border border-line-strong px-3.5 py-1.5 font-mono text-[0.68rem] uppercase tracking-wider text-ink hover:bg-paper-alt disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </span>
    </form>
  );
}

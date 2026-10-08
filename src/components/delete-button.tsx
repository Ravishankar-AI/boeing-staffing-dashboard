"use client";

/** Submits its own form after a browser confirm, so a stray click can't delete. */
export function DeleteButton({
  action,
  id,
  confirmText,
  children,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  confirmText: string;
  children: React.ReactNode;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="rounded-pill border border-critical px-4 py-2 font-mono text-[0.7rem] uppercase tracking-wider text-critical hover:bg-paper-alt"
      >
        {children}
      </button>
    </form>
  );
}

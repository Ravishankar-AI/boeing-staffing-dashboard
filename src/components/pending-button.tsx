"use client";

import { useTransition, type ReactNode } from "react";

/** A one-button form that shows a busy label while its action runs. */
export function PendingButton({
  action,
  children,
  busy,
  className,
}: {
  action: () => Promise<void>;
  children: ReactNode;
  busy: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => action())} className={`${className ?? ""} disabled:opacity-60`}>
      {pending ? busy : children}
    </button>
  );
}

"use client";

import { useTransition } from "react";
import { STAGES, STAGE_META, type Stage } from "@/lib/stages";
import { updateStage } from "@/app/actions";

export function StageSelect({ id, stage }: { id: string; stage: Stage }) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Update status"
      defaultValue={stage}
      disabled={pending}
      onChange={(e) => {
        const fd = new FormData();
        fd.set("id", id);
        fd.set("stage", e.target.value);
        startTransition(() => updateStage(fd));
      }}
      className="max-w-[190px] rounded-md border border-line bg-card px-2 py-1 font-mono text-[0.72rem] text-ink focus:border-signal focus:outline-none disabled:opacity-50"
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {STAGE_META[s].glyph} {STAGE_META[s].label}
        </option>
      ))}
    </select>
  );
}

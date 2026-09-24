import { STAGE_META, type Stage } from "@/lib/stages";

const TONE_TEXT: Record<string, string> = {
  neutral: "text-ink-soft",
  info: "text-info",
  warning: "text-warning",
  good: "text-good",
  critical: "text-critical",
  muted: "text-muted",
};

// Status is carried by glyph + label; the tone only colors the glyph, text
// stays in ink so it reads in both themes.
export function StagePill({ stage }: { stage: Stage }) {
  const meta = STAGE_META[stage];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-card px-2.5 py-0.5 text-[0.7rem] text-ink">
      <span className={`${TONE_TEXT[meta.tone]} font-bold`} aria-hidden>
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  );
}

export function OpenClosedPill({ open }: { open: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-card px-2.5 py-0.5 text-[0.7rem] text-ink">
      <span className={open ? "font-bold text-warning" : "font-bold text-good"} aria-hidden>
        {open ? "○" : "●"}
      </span>
      {open ? "Open" : "Closed"}
    </span>
  );
}

import { OPENING_META, type OpeningState } from "@/lib/stages";

const TONE_TEXT: Record<string, string> = {
  warning: "text-warning",
  good: "text-good",
  muted: "text-muted",
  info: "text-info",
  critical: "text-critical",
  neutral: "text-ink-soft",
};

export function OpeningPill({ state }: { state: OpeningState }) {
  const meta = OPENING_META[state];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-card px-2.5 py-0.5 text-[0.7rem] text-ink">
      <span className={`font-bold ${TONE_TEXT[meta.tone]}`} aria-hidden>
        {meta.glyph}
      </span>
      {meta.label}
    </span>
  );
}

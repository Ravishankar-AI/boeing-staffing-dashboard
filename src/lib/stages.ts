// Pipeline vocabulary, shared by server queries and client components.

export const STAGES = [
  "submitted",
  "shortlisted",
  "interview_scheduled",
  "awaiting_feedback",
  "on_hold",
  "selected",
  "onboarded",
  "screen_rejected",
  "interview_rejected",
  "withdrawn",
] as const;

export type Stage = (typeof STAGES)[number];

// tone → status color token in globals.css; always rendered with a glyph and
// the label, never color alone.
type Tone = "neutral" | "info" | "warning" | "good" | "critical" | "muted";

export const STAGE_META: Record<Stage, { label: string; tone: Tone; glyph: string; waitingOn: "Boeing" | "Objectways" | null }> = {
  submitted: { label: "Resume with Boeing", tone: "info", glyph: "○", waitingOn: "Boeing" },
  shortlisted: { label: "Shortlisted", tone: "info", glyph: "◔", waitingOn: "Boeing" },
  interview_scheduled: { label: "Interview scheduled", tone: "info", glyph: "◑", waitingOn: "Boeing" },
  awaiting_feedback: { label: "Awaiting feedback", tone: "warning", glyph: "◕", waitingOn: "Boeing" },
  on_hold: { label: "On hold", tone: "warning", glyph: "‖", waitingOn: "Boeing" },
  selected: { label: "Selected", tone: "good", glyph: "✓", waitingOn: "Objectways" },
  onboarded: { label: "Onboarded", tone: "good", glyph: "●", waitingOn: null },
  screen_rejected: { label: "Rejected at screening", tone: "critical", glyph: "✕", waitingOn: null },
  interview_rejected: { label: "Rejected after interview", tone: "critical", glyph: "✕", waitingOn: null },
  withdrawn: { label: "Candidate unavailable", tone: "muted", glyph: "–", waitingOn: null },
};

export const ACTIVE_STAGES: Stage[] = ["submitted", "shortlisted", "interview_scheduled", "awaiting_feedback", "on_hold", "selected"];
export const IN_INTERVIEW_STAGES: Stage[] = ["shortlisted", "interview_scheduled", "awaiting_feedback", "on_hold"];

export function isStage(s: string): s is Stage {
  return (STAGES as readonly string[]).includes(s);
}

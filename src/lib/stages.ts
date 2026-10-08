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

// --- Openings ---------------------------------------------------------------

// What an admin/recruiter can set. "Filled" is derived, never stored.
export const OPENING_STATUSES = ["open", "on_hold", "closed"] as const;
export type OpeningStatus = (typeof OPENING_STATUSES)[number];
export type OpeningState = "open" | "on_hold" | "filled" | "closed";

export const OPENING_META: Record<OpeningState, { label: string; glyph: string; tone: Tone; order: number }> = {
  open: { label: "Open", glyph: "○", tone: "warning", order: 0 },
  on_hold: { label: "On hold", glyph: "‖", tone: "muted", order: 1 },
  filled: { label: "Filled", glyph: "●", tone: "good", order: 2 },
  closed: { label: "Closed", glyph: "✕", tone: "muted", order: 3 },
};

export function isOpeningStatus(s: string | null): s is OpeningStatus {
  return !!s && (OPENING_STATUSES as readonly string[]).includes(s);
}

/** Closed (cancelled) wins, then filled headcount, then the stored status. */
export function openingState(p: { status: string; filled: number; required: number }): OpeningState {
  if (p.status === "closed") return "closed";
  if (p.filled >= p.required) return "filled";
  return p.status === "on_hold" ? "on_hold" : "open";
}

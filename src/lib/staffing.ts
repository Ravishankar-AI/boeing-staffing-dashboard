import { prisma } from "./db";
import { ACTIVE_STAGES, IN_INTERVIEW_STAGES, OPENING_META, STAGES, STAGE_META, openingState, type Stage } from "./stages";

export * from "./stages";

/**
 * Pipeline vocabulary and dashboard queries. The old workbook spread a
 * candidate's state across four free-text columns (selected for interview,
 * screening remarks, 1st-round feedback, selected for onboarding); here it
 * is one `stage` per submission so every view counts the same way.
 */

export type Filters = { engagement?: string; location?: string; stage?: string; q?: string };

export async function loadDashboard(filters: Filters = {}) {
  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      positions: {
        orderBy: [{ location: "desc" }, { title: "asc" }],
        include: { submissions: { orderBy: { sentAt: "desc" } } },
      },
    },
  });

  const scoped = engagements
    .filter((e) => !filters.engagement || e.code === filters.engagement)
    .map((e) => ({
      ...e,
      positions: e.positions.filter((p) => !filters.location || p.location === filters.location),
    }));

  const positions = scoped
    .flatMap((e) =>
      e.positions.map((p) => {
        const state = openingState(p);
        return { ...p, state, engagementName: e.name, engagementCode: e.code, boeingPoc: e.boeingPoc };
      }),
    )
    // Open first (most headcount still needed on top), then on hold, filled, closed.
    .sort(
      (a, b) =>
        OPENING_META[a.state].order - OPENING_META[b.state].order ||
        b.required - b.filled - (a.required - a.filled) ||
        a.engagementName.localeCompare(b.engagementName) ||
        a.title.localeCompare(b.title),
    );
  const submissions = positions.flatMap((p) =>
    p.submissions.map((s) => ({
      ...s,
      stage: s.stage as Stage,
      positionTitle: p.title,
      positionLocation: p.location,
      engagementName: p.engagementName,
      engagementCode: p.engagementCode,
    })),
  );

  // Headcount: cancelled ("closed") openings don't count toward requested or
  // filled. "Open positions" is people still needed on openings that are
  // actively hiring; on-hold headcount is reported separately.
  const live = positions.filter((p) => p.state !== "closed");
  const required = sum(live.map((p) => p.required));
  const filled = sum(live.map((p) => Math.min(p.filled, p.required)));
  const openPositions = positions.filter((p) => p.state === "open");
  const onHoldPositions = positions.filter((p) => p.state === "on_hold");
  const stateCounts = { open: 0, on_hold: 0, filled: 0, closed: 0 };
  for (const p of positions) stateCounts[p.state] += 1;

  const byStage = Object.fromEntries(STAGES.map((s) => [s, 0])) as Record<Stage, number>;
  for (const s of submissions) byStage[s.stage] += 1;

  const now = new Date();
  const last30 = submissions.filter((s) => now.getTime() - s.sentAt.getTime() <= 30 * 86_400_000).length;

  // Funnel: each step counts submissions that reached at least that point.
  const reachedInterview = submissions.filter(
    (s) => IN_INTERVIEW_STAGES.includes(s.stage) || ["selected", "onboarded", "interview_rejected"].includes(s.stage) || s.interviewAt,
  );
  const interviewed = reachedInterview.filter(
    (s) =>
      (s.interviewAt && s.interviewAt <= now) || ["awaiting_feedback", "on_hold", "selected", "onboarded", "interview_rejected"].includes(s.stage),
  );
  const selected = submissions.filter(
    (s) => s.stage === "selected" || s.stage === "onboarded" || /^(selected|passed)/i.test(s.feedback ?? ""),
  );
  const funnel = [
    { label: "Resumes sent", value: submissions.length },
    { label: "Shortlisted for interview", value: reachedInterview.length },
    { label: "Interviewed", value: interviewed.length },
    { label: "Selected", value: selected.length },
    { label: "Onboarded", value: byStage.onboarded },
  ];

  const waitingOnBoeing = submissions
    .filter((s) => STAGE_META[s.stage].waitingOn === "Boeing")
    .sort((a, b) => (a.interviewAt ?? a.sentAt).getTime() - (b.interviewAt ?? b.sentAt).getTime());
  const waitingOnObjectways = submissions.filter((s) => STAGE_META[s.stage].waitingOn === "Objectways");

  const filteredSubmissions = submissions
    .filter((s) => !filters.stage || (filters.stage === "active" ? ACTIVE_STAGES.includes(s.stage) : s.stage === filters.stage))
    .filter((s) => !filters.q || s.candidateName.toLowerCase().includes(filters.q.toLowerCase()))
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime() || b.sentAt.getTime() - a.sentAt.getTime());

  return {
    engagements: engagements.map((e) => ({ code: e.code, name: e.name })),
    positions,
    submissions: filteredSubmissions,
    totals: {
      required,
      filled,
      open: sum(openPositions.map((p) => p.required - p.filled)),
      openRoles: openPositions.length,
      onHold: sum(onHoldPositions.map((p) => p.required - p.filled)),
      roles: positions.length,
      resumesSent: submissions.length,
      last30,
      inInterview: sum(IN_INTERVIEW_STAGES.map((s) => byStage[s])),
      waitingOnBoeing: waitingOnBoeing.length,
      selectedOrOnboarded: byStage.selected + byStage.onboarded,
    },
    byStage,
    stateCounts,
    funnel,
    waitingOnBoeing,
    waitingOnObjectways,
  };
}

/** Positions for the Add/Edit candidate picker, grouped by engagement so the
 * same job title under two Boeing contacts can't be mistaken for a duplicate.
 * Open roles come first within each group. */
export async function listPositionGroups() {
  const engagements = await prisma.engagement.findMany({
    orderBy: { createdAt: "asc" },
    include: { positions: true },
  });
  return engagements
    .map((e) => ({
      label: `${e.name} · POC ${e.boeingPoc}`,
      options: e.positions
        .map((p) => {
          const state = openingState(p);
          const left = p.required - p.filled;
          const suffix =
            state === "open" ? `${left} open` : state === "on_hold" ? "on hold" : state === "filled" ? "filled" : "closed";
          return { id: p.id, label: `${p.title} · ${p.location} — ${suffix}`, order: OPENING_META[state].order, title: p.title };
        })
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
    .filter((g) => g.options.length > 0)
    .sort((a, b) => Math.min(...a.options.map((o) => o.order)) - Math.min(...b.options.map((o) => o.order)));
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

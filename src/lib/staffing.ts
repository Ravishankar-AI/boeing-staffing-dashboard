import { prisma } from "./db";
import { ACTIVE_STAGES, IN_INTERVIEW_STAGES, STAGES, STAGE_META, type Stage } from "./stages";

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

  const positions = scoped.flatMap((e) =>
    e.positions.map((p) => ({ ...p, engagementName: e.name, engagementCode: e.code, boeingPoc: e.boeingPoc })),
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

  const required = sum(positions.map((p) => p.required));
  const filled = sum(positions.map((p) => Math.min(p.filled, p.required)));
  const openPositions = positions.filter((p) => p.filled < p.required);

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
      open: required - filled,
      openRoles: openPositions.length,
      roles: positions.length,
      resumesSent: submissions.length,
      last30,
      inInterview: sum(IN_INTERVIEW_STAGES.map((s) => byStage[s])),
      waitingOnBoeing: waitingOnBoeing.length,
      selectedOrOnboarded: byStage.selected + byStage.onboarded,
    },
    byStage,
    funnel,
    waitingOnBoeing,
    waitingOnObjectways,
  };
}

export async function listPositionOptions() {
  const positions = await prisma.position.findMany({
    include: { engagement: true },
    orderBy: [{ engagement: { createdAt: "asc" } }, { location: "desc" }, { title: "asc" }],
  });
  return positions.map((p) => ({
    id: p.id,
    label: `${p.engagement.name} — ${p.title} (${p.location})`,
    open: p.filled < p.required,
  }));
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

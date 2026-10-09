import { prisma } from "./db";
import { ACTIVE_STAGES, IN_INTERVIEW_STAGES, OPENING_META, STAGES, STAGE_META, openingState, type Stage } from "./stages";

export * from "./stages";

/**
 * Pipeline vocabulary and dashboard queries. The old workbook spread a
 * candidate's state across four free-text columns (selected for interview,
 * screening remarks, 1st-round feedback, selected for onboarding); here it
 * is one `stage` per submission so every view counts the same way.
 */

export type Filters = { cr?: string; owner?: string; location?: string; stage?: string; q?: string };

/** Hires counted against an opening: whatever was entered on Openings, or the
 * number of its candidates marked Onboarded if that's higher — so onboarding
 * someone updates the count without a second manual edit. Capped at required. */
export function effectiveFilled(p: { filled: number; required: number }, onboarded: number) {
  return Math.min(p.required, Math.max(p.filled, onboarded));
}

export async function loadDashboard(filters: Filters = {}) {
  const [crs, owners] = await Promise.all([
    prisma.changeRequest.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        owners: { include: { owner: true } },
        positions: {
          include: {
            owner: true,
            submissions: {
              orderBy: { sentAt: "desc" },
              // Metadata only — never load file bytes into list views.
              include: { resume: { select: { filename: true, size: true } } },
            },
          },
        },
      },
    }),
    prisma.businessOwner.findMany({ orderBy: { name: "asc" } }),
  ]);

  const positions = crs
    .filter((cr) => !filters.cr || cr.code === filters.cr)
    .flatMap((cr) =>
      cr.positions
        .filter((p) => !filters.location || p.location === filters.location)
        .filter((p) => !filters.owner || p.businessOwnerId === filters.owner)
        .map((p) => {
          const onboarded = p.submissions.filter((s) => s.stage === "onboarded").length;
          const filled = effectiveFilled(p, onboarded);
          const state = openingState({ ...p, filled });
          return { ...p, filled, onboarded, state, crCode: cr.code, ownerName: p.owner?.name ?? null };
        }),
    )
    // Open first (most headcount still needed on top), then on hold, filled, closed.
    .sort(
      (a, b) =>
        OPENING_META[a.state].order - OPENING_META[b.state].order ||
        b.required - b.filled - (a.required - a.filled) ||
        a.crCode.localeCompare(b.crCode) ||
        a.title.localeCompare(b.title),
    );

  const submissions = positions.flatMap((p) =>
    p.submissions.map((s) => ({
      ...s,
      stage: s.stage as Stage,
      positionTitle: p.title,
      positionLocation: p.location,
      crCode: p.crCode,
      ownerName: p.ownerName,
    })),
  );

  // Headcount: cancelled ("closed") openings don't count toward requested or
  // filled. "Open positions" is people still needed on openings that are
  // actively hiring; on-hold headcount is reported separately.
  const live = positions.filter((p) => p.state !== "closed");
  const required = sum(live.map((p) => p.required));
  const filled = sum(live.map((p) => p.filled));
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
    crs: crs.map((cr) => ({ code: cr.code })),
    owners: owners.map((o) => ({ id: o.id, name: o.name })),
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

/** Positions for the Add/Edit candidate picker, grouped by change request,
 * each labelled with its business owner, open roles first. */
export async function listPositionGroups() {
  const crs = await prisma.changeRequest.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      positions: {
        include: { owner: true, _count: { select: { submissions: { where: { stage: "onboarded" } } } } },
      },
    },
  });
  return crs
    .map((cr) => ({
      label: cr.code,
      options: cr.positions
        .map((p) => {
          const filled = effectiveFilled(p, p._count.submissions);
          const state = openingState({ ...p, filled });
          const left = p.required - filled;
          const suffix =
            state === "open" ? `${left} open` : state === "on_hold" ? "on hold" : state === "filled" ? "filled" : "closed";
          return {
            id: p.id,
            label: `${p.title} · ${p.location}${p.owner ? ` · ${p.owner.name}` : ""} — ${suffix}`,
            order: OPENING_META[state].order,
            title: p.title,
          };
        })
        .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
    }))
    .filter((g) => g.options.length > 0)
    .sort((a, b) => Math.min(...a.options.map((o) => o.order)) - Math.min(...b.options.map((o) => o.order)));
}

function sum(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0);
}

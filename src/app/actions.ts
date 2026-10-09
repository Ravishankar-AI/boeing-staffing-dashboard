"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, type Role } from "@/lib/auth";
import { isOpeningStatus, isStage, openingState, OPENING_META, STAGE_META } from "@/lib/staffing";
import { logActivity } from "@/lib/activity";
import { readResume } from "@/lib/resumes";

function str(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? "").trim();
  return v.length ? v : null;
}

const ROLES: Role[] = ["admin", "recruiter", "client"];
const isRole = (r: string | null): r is Role => !!r && (ROLES as string[]).includes(r);

export async function updateStage(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const stage = str(formData, "stage");
  if (!id || !stage || !isStage(stage)) throw new Error("Invalid stage update");
  const before = await prisma.submission.findUniqueOrThrow({ where: { id } });
  if (before.stage === stage) return;
  await prisma.submission.update({ where: { id }, data: { stage } });
  await logActivity(
    session,
    "stage_change",
    `${before.candidateName}: ${STAGE_META[before.stage as keyof typeof STAGE_META]?.label ?? before.stage} → ${STAGE_META[stage].label}`,
  );
  revalidatePath("/", "layout");
}

export async function createSubmission(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const positionId = str(formData, "positionId");
  const candidateName = str(formData, "candidateName");
  if (!positionId || !candidateName) throw new Error("Position and candidate name are required");

  const resume = await readResume(formData.get("resume"));
  if (typeof resume === "string") redirect(`/submissions/new?error=${resume}`);

  const position = await prisma.position.findUniqueOrThrow({ where: { id: positionId }, include: { engagement: true } });
  const sentAt = str(formData, "sentAt");
  const interviewAt = str(formData, "interviewAt");
  const stage = str(formData, "stage") ?? "submitted";

  await prisma.submission.create({
    data: {
      positionId,
      candidateName,
      location: position.location,
      sentAt: sentAt ? new Date(sentAt) : new Date(),
      stage: isStage(stage) ? stage : "submitted",
      screeningNotes: str(formData, "screeningNotes"),
      interviewer: str(formData, "interviewer"),
      interviewAt: interviewAt ? new Date(interviewAt) : null,
      feedback: str(formData, "feedback"),
      onboardingNotes: str(formData, "onboardingNotes"),
      ...(resume ? { resume: { create: { ...resume, uploadedBy: session.name } } } : {}),
    },
  });
  await logActivity(
    session,
    "submission_create",
    `${candidateName} → ${position.title} (${position.location}) · ${position.engagement.name}${resume ? ` · resume ${resume.filename}` : " · no resume file"}`,
  );
  revalidatePath("/", "layout");
  redirect("/submissions");
}

const SUBMISSION_FIELDS = {
  candidateName: "name",
  positionId: "position",
  sentAt: "date sent",
  stage: "status",
  interviewer: "interviewer",
  interviewAt: "interview date",
  screeningNotes: "screening remarks",
  feedback: "feedback",
  onboardingNotes: "onboarding notes",
} as const;

export async function updateSubmission(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const positionId = str(formData, "positionId");
  const candidateName = str(formData, "candidateName");
  const stage = str(formData, "stage");
  const sentAt = str(formData, "sentAt");
  if (!id || !positionId || !candidateName || !sentAt || !stage || !isStage(stage)) throw new Error("Invalid candidate update");
  const interviewAt = str(formData, "interviewAt");
  const resume = await readResume(formData.get("resume"));
  if (typeof resume === "string") redirect(`/submissions/${id}?error=${resume}`);
  const removeResume = !resume && formData.get("removeResume") === "1";

  const [before, position] = await Promise.all([
    prisma.submission.findUniqueOrThrow({ where: { id } }),
    prisma.position.findUniqueOrThrow({ where: { id: positionId } }),
  ]);
  const data = {
    candidateName,
    positionId,
    location: position.location,
    sentAt: new Date(sentAt),
    stage,
    interviewer: str(formData, "interviewer"),
    interviewAt: interviewAt ? new Date(interviewAt) : null,
    screeningNotes: str(formData, "screeningNotes"),
    feedback: str(formData, "feedback"),
    onboardingNotes: str(formData, "onboardingNotes"),
  };
  const same = (a: unknown, b: unknown) =>
    a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() === (b as Date | null)?.getTime() : (a ?? null) === (b ?? null);
  const changed = (Object.keys(SUBMISSION_FIELDS) as (keyof typeof SUBMISSION_FIELDS)[]).filter((k) => !same(before[k], data[k]));

  if (resume) {
    await prisma.resumeFile.upsert({
      where: { submissionId: id },
      create: { submissionId: id, ...resume, uploadedBy: session.name },
      update: { ...resume, uploadedBy: session.name, uploadedAt: new Date() },
    });
    await logActivity(session, "resume_upload", `${candidateName} · ${resume.filename}`);
  } else if (removeResume) {
    const removed = await prisma.resumeFile.deleteMany({ where: { submissionId: id } });
    if (removed.count) await logActivity(session, "resume_remove", candidateName);
  }

  if (changed.length) {
    await prisma.submission.update({ where: { id }, data });
    const detail = changed
      .map((k) =>
        k === "stage"
          ? `status ${STAGE_META[before.stage as keyof typeof STAGE_META]?.label ?? before.stage} → ${STAGE_META[stage].label}`
          : k === "candidateName"
            ? `name ${before.candidateName} → ${candidateName}`
            : k === "positionId"
              ? `position → ${position.title} (${position.location})`
              : SUBMISSION_FIELDS[k],
      )
      .join(", ");
    await logActivity(session, "submission_update", `${candidateName}: ${detail}`);
  }
  revalidatePath("/", "layout");
  redirect(`/submissions?saved=${encodeURIComponent(candidateName)}`);
}

export async function deleteSubmission(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing candidate");
  const s = await prisma.submission.findUniqueOrThrow({ where: { id }, include: { position: { include: { engagement: true } } } });
  await prisma.submission.delete({ where: { id } });
  // The log keeps enough to identify what was removed, since the row is gone.
  await logActivity(
    session,
    "submission_delete",
    `${s.candidateName} — ${s.position.title} (${s.position.location}) · ${s.position.engagement.name} · was ${STAGE_META[s.stage as keyof typeof STAGE_META]?.label ?? s.stage}, sent ${s.sentAt.toISOString().slice(0, 10)}`,
  );
  revalidatePath("/", "layout");
  redirect(`/submissions?deleted=${encodeURIComponent(s.candidateName)}`);
}

export async function updatePosition(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const status = str(formData, "status");
  if (!id || !isOpeningStatus(status)) throw new Error("Invalid opening update");
  const required = Math.max(1, Math.floor(Number(formData.get("required") ?? 1)) || 1);
  const filled = Math.min(required, Math.max(0, Math.floor(Number(formData.get("filled") ?? 0)) || 0));
  const before = await prisma.position.findUniqueOrThrow({ where: { id } });
  const p = await prisma.position.update({
    where: { id },
    data: { required, filled, status, hiringManager: str(formData, "hiringManager") },
  });
  const was = OPENING_META[openingState(before)].label;
  const now = OPENING_META[openingState(p)].label;
  await logActivity(
    session,
    "position_update",
    `${p.title} (${p.location}): ${filled}/${required} filled${was !== now ? `, ${was} → ${now}` : ""}`,
  );
  revalidatePath("/", "layout");
}

export async function createPosition(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  const location = str(formData, "location");
  if (!engagementId || !title || !location) throw new Error("Engagement, title and location are required");
  const required = Math.max(1, Number(formData.get("required") ?? 1));
  const p = await prisma.position.create({
    data: { engagementId, title, location, required, hiringManager: str(formData, "hiringManager") },
    include: { engagement: true },
  });
  await logActivity(session, "position_create", `${title} (${location}), ${required} needed · ${p.engagement.name}`);
  revalidatePath("/", "layout");
  redirect(`/positions?engagement=${engagementId}#eng-${engagementId}`);
}

// --- Engagements (a Boeing request / change order with its own POC) ---

/** "CR05 · Navneet" → "CR05-NAVNEET", made unique. The code is what the
 * dashboard's engagement filter puts in the URL. */
async function engagementCode(name: string) {
  const base =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "ENGAGEMENT";
  for (let n = 1; ; n++) {
    const code = n === 1 ? base : `${base}-${n}`;
    if (!(await prisma.engagement.findUnique({ where: { code } }))) return code;
  }
}

export async function createEngagement(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const name = str(formData, "name");
  const boeingPoc = str(formData, "boeingPoc");
  if (!name || !boeingPoc) throw new Error("Engagement name and Boeing POC are required");
  const e = await prisma.engagement.create({ data: { name, boeingPoc, code: await engagementCode(name) } });
  await logActivity(session, "engagement_create", `${name} · POC ${boeingPoc}`);
  revalidatePath("/", "layout");
  // Land on the new engagement with the "new opening" form pointed at it.
  redirect(`/positions?engagement=${e.id}#add-opening`);
}

export async function updateEngagement(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const name = str(formData, "name");
  const boeingPoc = str(formData, "boeingPoc");
  if (!id || !name || !boeingPoc) throw new Error("Engagement name and Boeing POC are required");
  const before = await prisma.engagement.findUniqueOrThrow({ where: { id } });
  if (before.name === name && before.boeingPoc === boeingPoc) return;
  await prisma.engagement.update({ where: { id }, data: { name, boeingPoc } });
  const changes = [
    before.name !== name ? `name ${before.name} → ${name}` : null,
    before.boeingPoc !== boeingPoc ? `POC ${before.boeingPoc} → ${boeingPoc}` : null,
  ].filter(Boolean);
  await logActivity(session, "engagement_update", changes.join(", "));
  revalidatePath("/", "layout");
}

export async function deleteEngagement(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing engagement");
  const e = await prisma.engagement.findUniqueOrThrow({ where: { id }, include: { _count: { select: { positions: true } } } });
  // Only an empty engagement (e.g. created by mistake) can be deleted, so
  // openings and their candidates can never disappear this way.
  if (e._count.positions > 0) throw new Error("Remove or move its openings first");
  await prisma.engagement.delete({ where: { id } });
  await logActivity(session, "engagement_delete", `${e.name} · POC ${e.boeingPoc}`);
  revalidatePath("/", "layout");
  redirect("/positions");
}

// --- Accounts (admin only) ---

export async function approveUser(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const role = str(formData, "role");
  if (!id || !isRole(role)) throw new Error("Invalid approval");
  const u = await prisma.user.update({ where: { id }, data: { status: "active", role, approvedAt: new Date() } });
  await logActivity(session, "approve", `${u.name} (${u.email}) as ${role}`);
  revalidatePath("/", "layout");
}

export async function rejectUser(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing user");
  const u = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (u.status !== "pending") throw new Error("Only pending requests can be rejected");
  // Keep their past activity rows (userId goes null) but drop the account so
  // the email can register again.
  await prisma.$transaction([
    prisma.activityLog.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  await logActivity(session, "reject", `${u.name} (${u.email})`);
  revalidatePath("/", "layout");
}

export async function updateUser(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const role = str(formData, "role");
  const status = str(formData, "status");
  if (!id || !isRole(role) || (status !== "active" && status !== "disabled")) throw new Error("Invalid update");
  if (id === session.userId && (role !== "admin" || status !== "active")) {
    throw new Error("You can't remove your own admin access");
  }
  const before = await prisma.user.findUniqueOrThrow({ where: { id } });
  const u = await prisma.user.update({ where: { id }, data: { role, status } });
  if (before.role !== role) await logActivity(session, "role_change", `${u.name}: ${before.role} → ${role}`);
  if (before.status !== status) await logActivity(session, status === "disabled" ? "disable" : "enable", `${u.name} (${u.email})`);
  revalidatePath("/", "layout");
}

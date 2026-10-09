"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, type Role } from "@/lib/auth";
import { isOpeningStatus, isStage, openingState, OPENING_META, STAGE_META } from "@/lib/staffing";
import { logActivity } from "@/lib/activity";
import { readResume } from "@/lib/resumes";
import { processEmail, settleEmail, syncInbox } from "@/lib/inbox";

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

  const position = await prisma.position.findUniqueOrThrow({ where: { id: positionId }, include: { changeRequest: true } });
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
    `${candidateName} → ${position.title} (${position.location}) · ${position.changeRequest.code}${resume ? ` · resume ${resume.filename}` : " · no resume file"}`,
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
  const s = await prisma.submission.findUniqueOrThrow({ where: { id }, include: { position: { include: { changeRequest: true } } } });
  await prisma.submission.delete({ where: { id } });
  // The log keeps enough to identify what was removed, since the row is gone.
  await logActivity(
    session,
    "submission_delete",
    `${s.candidateName} — ${s.position.title} (${s.position.location}) · ${s.position.changeRequest.code} · was ${STAGE_META[s.stage as keyof typeof STAGE_META]?.label ?? s.stage}, sent ${s.sentAt.toISOString().slice(0, 10)}`,
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
  const before = await prisma.position.findUniqueOrThrow({ where: { id }, include: { owner: true } });
  const businessOwnerId = await openingOwner(formData, before.changeRequestId);
  const p = await prisma.position.update({
    where: { id },
    data: { required, filled, status, businessOwnerId, hiringManager: str(formData, "hiringManager") },
    include: { owner: true },
  });
  const was = OPENING_META[openingState(before)].label;
  const now = OPENING_META[openingState(p)].label;
  await logActivity(
    session,
    "position_update",
    `${p.title} (${p.location}): ${filled}/${required} filled${was !== now ? `, ${was} → ${now}` : ""}${
      before.owner?.name !== p.owner?.name ? `, owner ${before.owner?.name ?? "none"} → ${p.owner?.name ?? "none"}` : ""
    }`,
  );
  revalidatePath("/", "layout");
}

export async function createPosition(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const changeRequestId = str(formData, "changeRequestId");
  const title = str(formData, "title");
  const location = str(formData, "location");
  if (!changeRequestId || !title || !location) throw new Error("Change request, title and location are required");
  const required = Math.max(1, Number(formData.get("required") ?? 1));
  const businessOwnerId = await openingOwner(formData, changeRequestId);
  const p = await prisma.position.create({
    data: { changeRequestId, businessOwnerId, title, location, required, hiringManager: str(formData, "hiringManager") },
    include: { changeRequest: true, owner: true },
  });
  await logActivity(
    session,
    "position_create",
    `${title} (${location}), ${required} needed · ${p.changeRequest.code}${p.owner ? ` · ${p.owner.name}` : ""}`,
  );
  revalidatePath("/", "layout");
  redirect(`/positions?cr=${changeRequestId}#cr-${changeRequestId}`);
}

/** The opening's business owner from the form: a new name typed in, or the
 * owner picked from the list. Either way the owner is linked to the CR. */
async function openingOwner(formData: FormData, changeRequestId: string) {
  // A name typed into "new owner" wins over the dropdown.
  const typed = str(formData, "newOwner");
  const ownerId = typed ? ((await ownersFromText(typed)).ids[0] ?? null) : str(formData, "businessOwnerId");
  if (ownerId) await linkOwner(changeRequestId, ownerId);
  return ownerId;
}

// --- Change requests and business owners ---
// A CR can have several business owners and an owner can sit on several CRs
// (ChangeRequestOwner). Each opening belongs to one CR and one owner.

/** "Lakshmi, Christos" / "Lakshmi / Christos" → owner ids, creating owners
 * that don't exist yet. Matches existing names case-insensitively so
 * "lakshmi" doesn't become a second Lakshmi. */
async function ownersFromText(text: string | null) {
  const names = [...new Set((text ?? "").split(/\s*(?:,|\/|&|;)\s*/).map((n) => n.trim()).filter(Boolean))];
  const ids: string[] = [];
  const created: string[] = [];
  for (const name of names) {
    const existing = await prisma.businessOwner.findFirst({ where: { name: { equals: name, mode: "insensitive" } } });
    if (existing) ids.push(existing.id);
    else {
      ids.push((await prisma.businessOwner.create({ data: { name } })).id);
      created.push(name);
    }
  }
  return { ids, created };
}

async function linkOwner(changeRequestId: string, businessOwnerId: string) {
  await prisma.changeRequestOwner.upsert({
    where: { changeRequestId_businessOwnerId: { changeRequestId, businessOwnerId } },
    create: { changeRequestId, businessOwnerId },
    update: {},
  });
}

const crCode = (v: string | null) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, 40);

export async function createChangeRequest(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const code = crCode(str(formData, "code"));
  if (!code) redirect("/positions?error=cr_code");
  if (await prisma.changeRequest.findFirst({ where: { code: { equals: code, mode: "insensitive" } } })) {
    redirect(`/positions?error=cr_exists&code=${encodeURIComponent(code)}`);
  }
  const { ids, created } = await ownersFromText(str(formData, "owners"));
  const cr = await prisma.changeRequest.create({
    data: { code, title: str(formData, "title"), owners: { create: ids.map((businessOwnerId) => ({ businessOwnerId })) } },
    include: { owners: { include: { owner: true } } },
  });
  if (created.length) await logActivity(session, "owner_create", created.join(", "));
  await logActivity(session, "cr_create", `${code}${cr.owners.length ? ` · owners ${cr.owners.map((o) => o.owner.name).join(", ")}` : ""}`);
  revalidatePath("/", "layout");
  // Land on the new CR with the "new opening" form pointed at it.
  redirect(`/positions?cr=${cr.id}#add-opening`);
}

export async function updateChangeRequest(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const code = crCode(str(formData, "code"));
  if (!id || !code) throw new Error("CR code is required");
  const before = await prisma.changeRequest.findUniqueOrThrow({
    where: { id },
    include: { owners: { include: { owner: true } }, positions: { select: { businessOwnerId: true } } },
  });
  const clash = await prisma.changeRequest.findFirst({ where: { code: { equals: code, mode: "insensitive" }, id: { not: id } } });
  if (clash) throw new Error(`Another change request is already called ${code}`);

  const { ids, created } = await ownersFromText(str(formData, "owners"));
  // An owner who still has openings in this CR stays on it.
  const keep = new Set([...ids, ...before.positions.map((p) => p.businessOwnerId).filter((x): x is string => !!x)]);
  const title = str(formData, "title");
  await prisma.$transaction([
    prisma.changeRequest.update({ where: { id }, data: { code, title } }),
    prisma.changeRequestOwner.deleteMany({ where: { changeRequestId: id, businessOwnerId: { notIn: [...keep] } } }),
    ...[...keep].map((businessOwnerId) =>
      prisma.changeRequestOwner.upsert({
        where: { changeRequestId_businessOwnerId: { changeRequestId: id, businessOwnerId } },
        create: { changeRequestId: id, businessOwnerId },
        update: {},
      }),
    ),
  ]);
  const after = await prisma.businessOwner.findMany({ where: { id: { in: [...keep] } }, orderBy: { name: "asc" } });
  const was = before.owners.map((o) => o.owner.name).sort().join(", ");
  const now = after.map((o) => o.name).join(", ");
  const changes = [
    before.code !== code ? `code ${before.code} → ${code}` : null,
    (before.title ?? "") !== (title ?? "") ? "description" : null,
    was !== now ? `owners ${was || "none"} → ${now || "none"}` : null,
  ].filter(Boolean);
  if (created.length) await logActivity(session, "owner_create", created.join(", "));
  if (changes.length) await logActivity(session, "cr_update", `${code}: ${changes.join(", ")}`);
  revalidatePath("/", "layout");
}

export async function deleteChangeRequest(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing change request");
  const cr = await prisma.changeRequest.findUniqueOrThrow({ where: { id }, include: { _count: { select: { positions: true } } } });
  // Only an empty CR (e.g. created by mistake) can be deleted, so openings
  // and their candidates can never disappear this way.
  if (cr._count.positions > 0) throw new Error("Remove or move its openings first");
  await prisma.changeRequest.delete({ where: { id } });
  await logActivity(session, "cr_delete", cr.code);
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

// --- Mailbox import (recruiters and admins) ---

export async function checkInboxNow() {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const r = await syncInbox();
  await logActivity(session, "inbox_sync", r.message);
  revalidatePath("/", "layout");
}

export async function retryEmail(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing email");
  const email = await prisma.inboundEmail.findUniqueOrThrow({ where: { id }, include: { _count: { select: { attachments: true } } } });
  // Re-fetch attachments only if none were stored the first time.
  await processEmail(id, email._count.attachments === 0 ? email.graphId : null);
  revalidatePath("/", "layout");
}

export async function confirmDraft(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  const candidateName = str(formData, "candidateName");
  const positionId = str(formData, "positionId");
  const sentAt = str(formData, "sentAt");
  if (!id || !candidateName || !positionId || !sentAt) throw new Error("Name, position and date are required");
  const attachmentId = str(formData, "attachmentId");

  const draft = await prisma.emailDraft.findUniqueOrThrow({ where: { id }, include: { email: true } });
  if (draft.status !== "pending") return; // already handled (double click / two recruiters)
  const [position, file] = await Promise.all([
    prisma.position.findUniqueOrThrow({ where: { id: positionId }, include: { changeRequest: true } }),
    attachmentId ? prisma.emailAttachment.findFirst({ where: { id: attachmentId, emailId: draft.emailId } }) : null,
  ]);

  const submission = await prisma.$transaction(async (tx) => {
    // Claim the draft first so a concurrent confirm can't create a second candidate.
    const claimed = await tx.emailDraft.updateMany({ where: { id, status: "pending" }, data: { status: "confirmed" } });
    if (claimed.count === 0) return null;
    const s = await tx.submission.create({
      data: {
        positionId,
        candidateName,
        location: position.location,
        sentAt: new Date(sentAt),
        stage: "submitted",
        screeningNotes: str(formData, "screeningNotes"),
        ...(file
          ? {
              resume: {
                create: {
                  filename: file.filename,
                  contentType: file.contentType,
                  size: file.size,
                  data: file.data,
                  uploadedBy: `${session.name} (from email)`,
                },
              },
            }
          : {}),
      },
    });
    await tx.emailDraft.update({
      where: { id },
      data: { submissionId: s.id, candidateName, positionId, handledBy: session.name, handledAt: new Date() },
    });
    return s;
  });
  if (submission) {
    await logActivity(
      session,
      "email_import",
      `${candidateName} → ${position.title} (${position.location}) · ${position.changeRequest.code}${file ? ` · resume ${file.filename}` : ""} · from "${draft.email.subject}"`,
    );
  }
  await settleEmail(draft.emailId);
  revalidatePath("/", "layout");
}

export async function dismissDraft(formData: FormData) {
  const session = await requireRole("admin", "recruiter");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing draft");
  const d = await prisma.emailDraft.updateMany({
    where: { id, status: "pending" },
    data: { status: "dismissed", handledBy: session.name, handledAt: new Date() },
  });
  if (d.count) {
    const draft = await prisma.emailDraft.findUniqueOrThrow({ where: { id }, include: { email: true } });
    await logActivity(session, "email_dismiss", `${draft.candidateName} · from "${draft.email.subject}"`);
    await settleEmail(draft.emailId);
  }
  revalidatePath("/", "layout");
}

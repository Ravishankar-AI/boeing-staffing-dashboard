"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole, type Role } from "@/lib/auth";
import { isStage, STAGE_META } from "@/lib/staffing";
import { logActivity } from "@/lib/activity";

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
    },
  });
  await logActivity(session, "submission_create", `${candidateName} → ${position.title} (${position.location}) · ${position.engagement.name}`);
  revalidatePath("/", "layout");
  redirect("/submissions");
}

export async function updatePosition(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing position");
  const required = Math.max(0, Number(formData.get("required") ?? 0));
  const filled = Math.max(0, Number(formData.get("filled") ?? 0));
  const p = await prisma.position.update({
    where: { id },
    data: { required, filled, hiringManager: str(formData, "hiringManager") },
  });
  await logActivity(session, "position_update", `${p.title} (${p.location}): ${filled}/${required} filled`);
  revalidatePath("/", "layout");
}

export async function createPosition(formData: FormData) {
  const session = await requireRole("admin");
  if (!session) throw new Error("Not allowed");
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  const location = str(formData, "location");
  if (!engagementId || !title || !location) throw new Error("Engagement, title and location are required");
  const required = Math.max(1, Number(formData.get("required") ?? 1));
  await prisma.position.create({
    data: { engagementId, title, location, required, hiringManager: str(formData, "hiringManager") },
  });
  await logActivity(session, "position_create", `${title} (${location}), ${required} needed`);
  revalidatePath("/", "layout");
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

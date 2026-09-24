"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { isStage } from "@/lib/staffing";

function str(formData: FormData, key: string) {
  const v = String(formData.get(key) ?? "").trim();
  return v.length ? v : null;
}

export async function updateStage(formData: FormData) {
  if (!(await requireRole("admin", "recruiter"))) throw new Error("Not allowed");
  const id = str(formData, "id");
  const stage = str(formData, "stage");
  if (!id || !stage || !isStage(stage)) throw new Error("Invalid stage update");
  await prisma.submission.update({ where: { id }, data: { stage } });
  revalidatePath("/", "layout");
}

export async function createSubmission(formData: FormData) {
  if (!(await requireRole("admin", "recruiter"))) throw new Error("Not allowed");
  const positionId = str(formData, "positionId");
  const candidateName = str(formData, "candidateName");
  if (!positionId || !candidateName) throw new Error("Position and candidate name are required");

  const position = await prisma.position.findUniqueOrThrow({ where: { id: positionId } });
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
  revalidatePath("/", "layout");
  redirect("/submissions");
}

export async function updatePosition(formData: FormData) {
  if (!(await requireRole("admin"))) throw new Error("Not allowed");
  const id = str(formData, "id");
  if (!id) throw new Error("Missing position");
  const required = Math.max(0, Number(formData.get("required") ?? 0));
  const filled = Math.max(0, Number(formData.get("filled") ?? 0));
  await prisma.position.update({ where: { id }, data: { required, filled, hiringManager: str(formData, "hiringManager") } });
  revalidatePath("/", "layout");
}

export async function createPosition(formData: FormData) {
  if (!(await requireRole("admin"))) throw new Error("Not allowed");
  const engagementId = str(formData, "engagementId");
  const title = str(formData, "title");
  const location = str(formData, "location");
  if (!engagementId || !title || !location) throw new Error("Engagement, title and location are required");
  await prisma.position.create({
    data: {
      engagementId,
      title,
      location,
      required: Math.max(1, Number(formData.get("required") ?? 1)),
      hiringManager: str(formData, "hiringManager"),
    },
  });
  revalidatePath("/", "layout");
}

import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listPositionGroups } from "@/lib/staffing";
import { createSubmission } from "@/app/actions";
import { SubmissionForm } from "@/components/submission-form";
import { RESUME_ERRORS, type ResumeError } from "@/lib/resumes";
import { UploadError } from "@/components/upload-error";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add resume — Objectways Talent" };

export default async function NewSubmissionPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const groups = await listPositionGroups();
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Add a resume sent to Boeing</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">
        It shows up on Boeing&apos;s dashboard as soon as you save. Positions are grouped by change request, open roles first.
      </p>
      {error && error in RESUME_ERRORS && <UploadError message={RESUME_ERRORS[error as ResumeError]} />}
      <SubmissionForm action={createSubmission} groups={groups} submitLabel="Save resume" />
    </div>
  );
}

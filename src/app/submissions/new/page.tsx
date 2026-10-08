import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { listPositionGroups } from "@/lib/staffing";
import { createSubmission } from "@/app/actions";
import { SubmissionForm } from "@/components/submission-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add resume — Objectways Talent" };

export default async function NewSubmissionPage() {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const groups = await listPositionGroups();

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-8">
      <h1 className="mb-2 text-[2rem]">Add a resume sent to Boeing</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">
        It shows up on Boeing&apos;s dashboard as soon as you save. Positions are grouped by engagement, open roles first.
      </p>
      <SubmissionForm action={createSubmission} groups={groups} submitLabel="Save resume" />
    </div>
  );
}

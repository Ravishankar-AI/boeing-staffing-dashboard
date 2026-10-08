import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listPositionGroups } from "@/lib/staffing";
import { formatDate } from "@/lib/format";
import { deleteSubmission, updateSubmission } from "@/app/actions";
import { SubmissionForm } from "@/components/submission-form";
import { DeleteButton } from "@/components/delete-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit candidate — Objectways Talent" };

export default async function EditSubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await requireRole("admin", "recruiter"))) redirect("/");
  const { id } = await params;
  const [submission, groups] = await Promise.all([prisma.submission.findUnique({ where: { id } }), listPositionGroups()]);
  if (!submission) notFound();

  return (
    <div className="mx-auto max-w-[720px] px-4 py-10 sm:px-8">
      <Link href="/submissions" className="text-[0.72rem] uppercase tracking-wider text-signal-ink hover:underline">
        ← Candidates
      </Link>
      <h1 className="mb-2 mt-3 text-[2rem]">Edit {submission.candidateName}</h1>
      <p className="mb-8 text-[0.85rem] text-ink-soft">
        Added {formatDate(submission.createdAt)} · last changed {formatDate(submission.updatedAt)}. Changes are recorded in
        the activity log.
      </p>
      <SubmissionForm action={updateSubmission} groups={groups} values={submission} id={submission.id} submitLabel="Save changes">
        <Link href="/submissions" className="px-2 text-[0.72rem] uppercase tracking-wider text-ink-soft hover:text-ink">
          Cancel
        </Link>
      </SubmissionForm>

      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-md border border-dashed border-line p-6">
        <div>
          <h2 className="text-[1rem]">Delete this candidate</h2>
          <p className="text-[0.78rem] text-ink-soft">
            For entries added by mistake. It disappears from every dashboard, including Boeing&apos;s.
          </p>
        </div>
        <DeleteButton
          action={deleteSubmission}
          id={submission.id}
          confirmText={`Delete ${submission.candidateName}? This can't be undone.`}
        >
          Delete
        </DeleteButton>
      </section>
    </div>
  );
}

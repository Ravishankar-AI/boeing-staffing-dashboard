import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

/** Download a candidate's resume. Any signed-in, approved user can download
 * (Boeing reviewers need them); every download is recorded in the activity
 * log. `id` is the submission id. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return new Response("Sign in to download resumes.", { status: 401 });

  const { id } = await params;
  const file = await prisma.resumeFile.findUnique({
    where: { submissionId: id },
    include: { submission: { select: { candidateName: true } } },
  });
  if (!file) return new Response("Resume not found.", { status: 404 });

  await logActivity(session, "resume_download", `${file.submission.candidateName} · ${file.filename}`);

  const ascii = file.filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Length": String(file.size),
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.filename)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}

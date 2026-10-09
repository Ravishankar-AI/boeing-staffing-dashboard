import { prisma } from "./db";
import { graphConfigured, listAttachments, listMessages, mailbox, type GraphMessage } from "./graph";
import { extractCandidates, type OpeningForMatching } from "./extract";
import { readResumeBytes } from "./resumes";
import { effectiveFilled, openingState, OPENING_META } from "./staffing";

// Mailbox import: fetch new mail from consulting@, store each email once,
// keep valid resume attachments, and let Claude propose draft candidates.
// Runs from the cron endpoint (src/app/api/inbox/sync) and the Inbox page's
// "Check now" button; a lock row stops two runs overlapping.

const LAST_SYNC = "inbox_last_sync";
const LOCK = "inbox_sync_lock";
const FIRST_RUN_DAYS = 14;
const MAX_BODY_CHARS = 60_000;

export type SyncResult = {
  at: string;
  ok: boolean;
  message: string;
  fetched: number;
  newEmails: number;
  drafts: number;
};

export function inboxConfigured() {
  return graphConfigured() && !!process.env.ANTHROPIC_API_KEY;
}

export async function lastSync(): Promise<SyncResult | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: LAST_SYNC } });
  return row ? (JSON.parse(row.value) as SyncResult) : null;
}

/** Take the lock unless another run took it in the last 10 minutes. */
async function acquireLock() {
  const n = await prisma.$executeRaw`
    INSERT INTO "AppSetting" ("key", "value", "updatedAt") VALUES (${LOCK}, 'locked', now())
    ON CONFLICT ("key") DO UPDATE SET "value" = 'locked', "updatedAt" = now()
    WHERE "AppSetting"."updatedAt" < now() - interval '10 minutes'`;
  return n > 0;
}

async function releaseLock() {
  await prisma.appSetting.deleteMany({ where: { key: LOCK } });
}

export async function syncInbox(): Promise<SyncResult> {
  const at = new Date().toISOString();
  if (!inboxConfigured()) {
    return { at, ok: false, message: "Mailbox import isn't set up yet.", fetched: 0, newEmails: 0, drafts: 0 };
  }
  if (!(await acquireLock())) {
    return { at, ok: true, message: "A check is already running.", fetched: 0, newEmails: 0, drafts: 0 };
  }

  let result: SyncResult;
  try {
    // Look back a day past the newest stored email so late-arriving mail
    // isn't missed; ids already stored are skipped.
    const newest = await prisma.inboundEmail.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } });
    const since = newest
      ? new Date(newest.receivedAt.getTime() - 86_400_000)
      : new Date(Date.now() - FIRST_RUN_DAYS * 86_400_000);

    const messages = await listMessages(since);
    const known = new Set(
      (await prisma.inboundEmail.findMany({ where: { graphId: { in: messages.map((m) => m.id) } }, select: { graphId: true } })).map(
        (e) => e.graphId,
      ),
    );
    const fresh = messages.filter((m) => !known.has(m.id)).reverse(); // oldest first

    let drafts = 0;
    for (const m of fresh) drafts += await importMessage(m);

    result = {
      at,
      ok: true,
      message: fresh.length ? `${fresh.length} new email${fresh.length === 1 ? "" : "s"}, ${drafts} draft${drafts === 1 ? "" : "s"}` : "No new email",
      fetched: messages.length,
      newEmails: fresh.length,
      drafts,
    };
  } catch (e) {
    result = { at, ok: false, message: e instanceof Error ? e.message : String(e), fetched: 0, newEmails: 0, drafts: 0 };
  } finally {
    await releaseLock();
  }

  await prisma.appSetting.upsert({
    where: { key: LAST_SYNC },
    create: { key: LAST_SYNC, value: JSON.stringify(result) },
    update: { value: JSON.stringify(result) },
  });
  return result;
}

const person = (p?: { emailAddress?: { name?: string; address?: string } }) =>
  p?.emailAddress ? `${p.emailAddress.name ?? ""} <${p.emailAddress.address ?? ""}>`.trim() : "";

/** Store one email and its resumes, then run extraction. Returns drafts made. */
async function importMessage(m: GraphMessage): Promise<number> {
  const recipients = [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])]
    .map(person)
    .filter((r) => !r.toLowerCase().includes(mailbox().toLowerCase()))
    .join(", ");
  let bodyText = (m.body?.content ?? "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (bodyText.length > MAX_BODY_CHARS) bodyText = `${bodyText.slice(0, MAX_BODY_CHARS)}\n[… email truncated for storage]`;

  const email = await prisma.inboundEmail.create({
    data: {
      graphId: m.id,
      subject: m.subject?.trim() || "(no subject)",
      fromName: m.from?.emailAddress?.name ?? null,
      fromAddress: m.from?.emailAddress?.address ?? null,
      recipients,
      receivedAt: new Date(m.receivedDateTime),
      bodyText,
      status: "error",
      error: "Processing didn't finish",
    },
  });
  return processEmail(email.id, m.hasAttachments ? m.id : null);
}

/** (Re)run extraction for a stored email. `graphId` set = fetch attachments first. */
export async function processEmail(emailId: string, fetchAttachmentsFor: string | null): Promise<number> {
  try {
    if (fetchAttachmentsFor) {
      for (const a of await listAttachments(fetchAttachmentsFor)) {
        const file = readResumeBytes(a.name, Buffer.from(a.contentBytes ?? "", "base64"));
        if (typeof file === "string" || !file) continue; // not a PDF/Word resume
        await prisma.emailAttachment.create({ data: { emailId, ...file } });
      }
    }
    const email = await prisma.inboundEmail.findUniqueOrThrow({ where: { id: emailId }, include: { attachments: true } });
    const openings = await openingsForMatching();

    const extraction = await extractCandidates(
      {
        subject: email.subject,
        from: `${email.fromName ?? ""} <${email.fromAddress ?? ""}>`,
        recipients: email.recipients,
        receivedAt: email.receivedAt,
        bodyText: email.bodyText,
        attachments: email.attachments,
      },
      openings,
    );

    // Only accept ids and filenames we actually gave Claude.
    const openingIds = new Set(openings.map((o) => o.id));
    const byName = new Map(email.attachments.map((a) => [a.filename.toLowerCase(), a.id]));
    const candidates = extraction.is_profile_submission ? extraction.candidates.filter((c) => c.name.trim()) : [];
    const lone = email.attachments.length === 1 && candidates.length === 1 ? email.attachments[0].id : null;

    await prisma.emailDraft.deleteMany({ where: { emailId, status: "pending" } });
    for (const c of candidates) {
      const positionId = c.position_id && openingIds.has(c.position_id) ? c.position_id : null;
      const dup = await prisma.submission.findFirst({
        where: { candidateName: { equals: c.name.trim(), mode: "insensitive" }, ...(positionId ? { positionId } : {}) },
        select: { id: true },
      });
      await prisma.emailDraft.create({
        data: {
          emailId,
          candidateName: c.name.trim(),
          positionId,
          attachmentId: (c.resume_filename && byName.get(c.resume_filename.toLowerCase())) || lone,
          note: [dup ? "Possible duplicate: a candidate with this name is already in the app." : null, c.reasoning]
            .filter(Boolean)
            .join(" "),
        },
      });
    }

    await prisma.inboundEmail.update({
      where: { id: emailId },
      data: { status: candidates.length ? "parsed" : "no_profiles", error: null, summary: extraction.summary },
    });
    return candidates.length;
  } catch (e) {
    await prisma.inboundEmail.update({
      where: { id: emailId },
      data: { status: "error", error: e instanceof Error ? e.message.slice(0, 500) : String(e) },
    });
    return 0;
  }
}

async function openingsForMatching(): Promise<OpeningForMatching[]> {
  const positions = await prisma.position.findMany({
    include: {
      changeRequest: true,
      owner: true,
      _count: { select: { submissions: { where: { stage: "onboarded" } } } },
    },
  });
  return positions.map((p) => ({
    id: p.id,
    cr: p.changeRequest.code,
    owner: p.owner?.name ?? null,
    title: p.title,
    location: p.location,
    reviewer: p.hiringManager,
    status: OPENING_META[openingState({ ...p, filled: effectiveFilled(p, p._count.submissions) })].label,
  }));
}

/** Mark an email done once none of its drafts are pending. */
export async function settleEmail(emailId: string) {
  const pending = await prisma.emailDraft.count({ where: { emailId, status: "pending" } });
  if (pending === 0) {
    await prisma.inboundEmail.updateMany({ where: { id: emailId, status: "parsed" }, data: { status: "done" } });
  }
}

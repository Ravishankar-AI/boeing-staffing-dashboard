import { timingSafeEqual } from "node:crypto";
import { syncInbox } from "@/lib/inbox";

export const dynamic = "force-dynamic";
// Extraction can take a while for a batch of emails with PDFs.
export const maxDuration = 300;

/** Called every 10 minutes by the Railway cron service with
 * `Authorization: Bearer $CRON_SECRET`. */
export async function POST(req: Request) {
  const expected = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok =
    !!expected && expected.length >= 32 && given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await syncInbox();
  return Response.json(result, { status: result.ok ? 200 : 502 });
}

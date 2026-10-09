// Read-only Microsoft Graph client for the consulting@ mailbox.
//
// Uses the OAuth client-credentials flow with an Azure app registration that
// has the *application* permission Mail.Read. In Exchange Online, that
// permission should be scoped to this one mailbox (RBAC for Applications or an
// ApplicationAccessPolicy) so the app can't read anyone else's mail; see the
// README. This module never writes to the mailbox.

const LOGIN_BASE = process.env.MS_LOGIN_BASE_URL ?? "https://login.microsoftonline.com";
const GRAPH_BASE = process.env.MS_GRAPH_BASE_URL ?? "https://graph.microsoft.com/v1.0";

export function mailbox() {
  return process.env.INBOX_MAILBOX ?? "consulting@objectways.com";
}

export function graphConfigured() {
  return !!(process.env.MS_TENANT_ID && process.env.MS_CLIENT_ID && process.env.MS_CLIENT_SECRET);
}

export type GraphMessage = {
  id: string;
  subject: string | null;
  receivedDateTime: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  ccRecipients?: { emailAddress?: { name?: string; address?: string } }[];
  body?: { contentType?: string; content?: string };
  hasAttachments?: boolean;
};

export type GraphAttachment = {
  "@odata.type": string;
  name: string;
  contentType?: string;
  size: number;
  isInline?: boolean;
  contentBytes?: string;
};

let cached: { token: string; expires: number } | null = null;

async function token() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const res = await fetch(`${LOGIN_BASE}/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID ?? "",
      client_secret: process.env.MS_CLIENT_SECRET ?? "",
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new Error(`Microsoft sign-in failed (${res.status}): ${json.error_description?.split("\n")[0] ?? "no token"}`);
  }
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${await token()}`, prefer: 'outlook.body-content-type="text"' },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    throw new Error(`Microsoft Graph ${res.status} ${body.error?.code ?? ""}: ${body.error?.message ?? res.statusText}`.trim());
  }
  return (await res.json()) as T;
}

/** Inbox messages received at or after `since`, newest first (up to `max`). */
export async function listMessages(since: Date, max = 200): Promise<GraphMessage[]> {
  const select = "id,subject,receivedDateTime,from,toRecipients,ccRecipients,body,hasAttachments";
  let url: string | undefined =
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox())}/mailFolders/inbox/messages` +
    `?$select=${select}&$top=50&$orderby=receivedDateTime desc` +
    `&$filter=${encodeURIComponent(`receivedDateTime ge ${since.toISOString()}`)}`;
  const out: GraphMessage[] = [];
  while (url && out.length < max) {
    const page: { value: GraphMessage[]; "@odata.nextLink"?: string } = await get(url);
    out.push(...page.value);
    url = page["@odata.nextLink"];
  }
  return out.slice(0, max);
}

/** File attachments of a message (inline images and item attachments skipped). */
export async function listAttachments(messageId: string): Promise<GraphAttachment[]> {
  const page = await get<{ value: GraphAttachment[] }>(
    `${GRAPH_BASE}/users/${encodeURIComponent(mailbox())}/messages/${encodeURIComponent(messageId)}/attachments`,
  );
  return page.value.filter((a) => a["@odata.type"] === "#microsoft.graph.fileAttachment" && !a.isInline && a.contentBytes);
}

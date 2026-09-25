import { prisma } from "./db";
import type { Session } from "./auth";

/** Record an event for the admin activity feed. Never throws: a logging
 * failure must not break the action being logged. */
export async function logActivity(
  who: Session | { id: string | null; name: string },
  action: string,
  detail?: string,
) {
  const userId = "userId" in who ? who.userId : who.id;
  try {
    await prisma.activityLog.create({ data: { userId, actor: who.name, action, detail } });
  } catch (e) {
    console.error("activity log failed", action, e);
  }
}

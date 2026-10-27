import "server-only";
import { db, schema } from "./db";

export type LogKind = "access" | "library" | "meeting" | "project" | "admin";

/** 참여 로그 기록. 실패해도 본 작업은 막지 않는다. */
export async function logActivity(userId: string | null | undefined, kind: LogKind, action: string,
  opts: { label?: string | null; targetId?: string | null; projectId?: string | null } = {}) {
  if (!userId) return;
  try {
    await db.insert(schema.activityLog).values({
      userId, kind, action, label: opts.label?.slice(0, 200) ?? null, targetId: opts.targetId ?? null, projectId: opts.projectId ?? null,
    });
  } catch (e) {
    console.error("[twb] activity log failed", e);
  }
}

"use server";

import { revalidatePath } from "next/cache";
import { and, count, eq, isNull, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole, newToken, type Role } from "@/lib/auth";
import { run, UserError } from "@/lib/result";

const ROLES: Role[] = ["admin", "editor", "viewer"];
const refresh = () => revalidatePath("/", "layout");

export async function inviteMember(email: string, role: Role) {
  return run(async () => {
    const me = await assertRole("admin");
    const e = email.trim().toLowerCase();
    if (!e.includes("@")) throw new UserError("이메일을 확인해 주세요.");
    if (!ROLES.includes(role)) throw new UserError("역할이 올바르지 않습니다.");
    const max = Number(process.env.MAX_MEMBERS ?? 10);
    const [{ n }] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.active, true));
    const [{ p }] = await db.select({ p: count() }).from(schema.invites).where(isNull(schema.invites.acceptedAt));
    if (n + p >= max) throw new UserError(`팀 인원(대기 중 초대 포함)이 최대 ${max}명입니다.`);
    const [active] = await db.select().from(schema.users)
      .where(and(eq(schema.users.email, e), eq(schema.users.active, true))).limit(1);
    if (active) throw new UserError("이미 팀에 있는 이메일입니다.");
    // 같은 이메일의 기존 대기 초대는 정리
    await db.delete(schema.invites).where(and(eq(schema.invites.email, e), isNull(schema.invites.acceptedAt)));
    const token = newToken();
    await db.insert(schema.invites).values({ email: e, role, token, invitedBy: me.id });
    refresh();
    return { token };
  });
}

export async function cancelInvite(id: string) {
  return run(async () => {
    await assertRole("admin");
    await db.delete(schema.invites).where(eq(schema.invites.id, id));
    refresh();
    return null;
  });
}

/** 기존 초대를 새 링크로 교체 (재발송) */
export async function renewInvite(id: string) {
  return run(async () => {
    await assertRole("admin");
    const token = newToken();
    await db.update(schema.invites).set({ token, createdAt: new Date() }).where(eq(schema.invites.id, id));
    refresh();
    return { token };
  });
}

async function adminCountExcept(userId: string) {
  const [{ n }] = await db.select({ n: count() }).from(schema.users).where(and(
    eq(schema.users.role, "admin"), eq(schema.users.active, true), ne(schema.users.id, userId),
  ));
  return n;
}

export async function changeRole(userId: string, role: Role) {
  return run(async () => {
    await assertRole("admin");
    if (!ROLES.includes(role)) throw new UserError("역할이 올바르지 않습니다.");
    if (role !== "admin" && (await adminCountExcept(userId)) === 0) throw new UserError("관리자가 최소 1명은 있어야 합니다.");
    await db.update(schema.users).set({ role }).where(eq(schema.users.id, userId));
    refresh();
    return null;
  });
}

/** 해지: 담당 태스크는 미배정으로, 댓글·기록은 유지 */
export async function deactivateMember(userId: string) {
  return run(async () => {
    const me = await assertRole("admin");
    if (me.id === userId) throw new UserError("본인은 해지할 수 없습니다.");
    if ((await adminCountExcept(userId)) === 0) throw new UserError("관리자가 최소 1명은 있어야 합니다.");
    await db.transaction(async (tx) => {
      await tx.update(schema.users).set({ active: false }).where(eq(schema.users.id, userId));
      await tx.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
      await tx.update(schema.tasks).set({ assigneeId: null }).where(eq(schema.tasks.assigneeId, userId));
    });
    refresh();
    return null;
  });
}

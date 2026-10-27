"use server";

import { redirect } from "next/navigation";
import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { AVATAR_COLORS } from "@/lib/format";
import { logActivity } from "@/lib/audit";

export type FormState = { error?: string } | undefined;

const norm = (v: FormDataEntryValue | null) => String(v ?? "").trim();

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = norm(fd.get("email")).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const [u] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!u) {
    // 초대만 받고 아직 가입하지 않은 이메일이면 그 사실을 알려 준다
    const [inv] = await db.select({ id: schema.invites.id }).from(schema.invites)
      .where(and(eq(schema.invites.email, email), isNull(schema.invites.acceptedAt))).limit(1);
    if (inv) return { error: "아직 가입이 완료되지 않은 초대 이메일입니다. 관리자에게 받은 초대 링크(…/invite/…)를 열어 이름과 비밀번호를 정하면 가입이 끝납니다. 링크가 없으면 관리자에게 다시 요청하세요." };
    return { error: "이메일 또는 비밀번호가 맞지 않습니다." };
  }
  if (!(await verifyPassword(password, u.passwordHash))) return { error: "이메일 또는 비밀번호가 맞지 않습니다." };
  if (!u.active) return { error: "해지된 계정입니다. 관리자에게 문의하세요." };
  await createSession(u.id);
  await logActivity(u.id, "access", "login");
  // 같은 순간 '접속'이 중복 기록되지 않도록 마지막 접속 시각도 함께 갱신
  await db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, u.id));
  redirect("/");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

/** 최초 1회: 관리자 계정 생성 (사용자가 0명일 때만 허용) */
export async function setupAction(_: FormState, fd: FormData): Promise<FormState> {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n > 0) return { error: "이미 초기 설정이 끝났습니다. 로그인해 주세요." };
  const name = norm(fd.get("name"));
  const email = norm(fd.get("email")).toLowerCase();
  const password = String(fd.get("password") ?? "");
  const teamProject = norm(fd.get("project"));
  if (!name || !email.includes("@")) return { error: "이름과 이메일을 확인해 주세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  const [u] = await db.insert(schema.users).values({
    name, email, passwordHash: await hashPassword(password), role: "admin", color: AVATAR_COLORS[0],
  }).returning();
  await logActivity(u.id, "access", "joined", { label: "관리자" });
  if (teamProject) {
    const [p] = await db.insert(schema.projects).values({ title: teamProject }).returning();
    await logActivity(u.id, "project", "project_create", { label: p.title, projectId: p.id, targetId: p.id });
  }
  await createSession(u.id);
  redirect("/");
}

/** 초대 링크로 가입 */
export async function acceptInviteAction(_: FormState, fd: FormData): Promise<FormState> {
  const token = norm(fd.get("token"));
  const name = norm(fd.get("name"));
  const password = String(fd.get("password") ?? "");
  const [inv] = await db.select().from(schema.invites)
    .where(and(eq(schema.invites.token, token), isNull(schema.invites.acceptedAt))).limit(1);
  if (!inv) return { error: "만료되었거나 이미 사용된 초대 링크입니다." };
  if (Date.now() - inv.createdAt.getTime() > 14 * 86400_000) return { error: "초대 링크가 만료되었습니다(14일). 다시 초대를 요청하세요." };
  if (!name) return { error: "이름을 입력해 주세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };

  const max = Number(process.env.MAX_MEMBERS ?? 10);
  const [{ n }] = await db.select({ n: count() }).from(schema.users).where(eq(schema.users.active, true));
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, inv.email)).limit(1);
  if (!existing && n >= max) return { error: `팀 인원이 가득 찼습니다(최대 ${max}명).` };

  let userId: string;
  if (existing) {
    // 해지됐던 팀원이 다시 초대된 경우: 계정 재활성화
    await db.update(schema.users).set({
      name, passwordHash: await hashPassword(password), role: inv.role, active: true,
    }).where(eq(schema.users.id, existing.id));
    userId = existing.id;
  } else {
    const color = AVATAR_COLORS[n % AVATAR_COLORS.length];
    const [u] = await db.insert(schema.users).values({
      name, email: inv.email, passwordHash: await hashPassword(password), role: inv.role, color,
    }).returning();
    userId = u.id;
  }
  await db.update(schema.invites).set({ acceptedAt: new Date() }).where(eq(schema.invites.id, inv.id));
  await logActivity(userId, "access", "joined", { label: inv.role });
  await createSession(userId);
  redirect("/");
}

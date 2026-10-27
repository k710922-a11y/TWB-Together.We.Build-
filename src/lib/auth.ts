import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt } from "drizzle-orm";
import { db, schema } from "./db";

const COOKIE = "twb_session";
const SESSION_DAYS = 30;

export type Role = "admin" | "editor" | "viewer";
export type CurrentUser = { id: string; name: string; email: string; role: Role; color: string };

export const hashPassword = (pw: string) => bcrypt.hash(pw, 10);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
export const newToken = () => randomBytes(32).toString("base64url");

async function isHttps() {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "";
  return proto.split(",")[0].trim() === "https";
}

export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(schema.sessions).values({ token, userId, expiresAt });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: await isHttps(),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  jar.delete(COOKIE);
}

/** 요청당 한 번만 조회 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({
      id: schema.users.id, name: schema.users.name, email: schema.users.email,
      role: schema.users.role, color: schema.users.color, active: schema.users.active,
      lastSeenAt: schema.users.lastSeenAt,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.token, token), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  // '온라인' 표시용 마지막 접속 시각 (1분 단위로만 갱신)
  if (!u.lastSeenAt || Date.now() - u.lastSeenAt.getTime() > 60_000) {
    await db.update(schema.users).set({ lastSeenAt: new Date() }).where(eq(schema.users.id, u.id));
  }
  return { id: u.id, name: u.name, email: u.email, role: u.role as Role, color: u.color };
});

/** 페이지용: 로그인 안 되어 있으면 로그인 화면으로 */
export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

/** 서버 액션용: 권한 부족 시 에러 */
export async function assertRole(min: Role): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("로그인이 필요합니다.");
  if (RANK[u.role] < RANK[min]) {
    throw new Error(min === "admin" ? "관리자만 할 수 있습니다." : "보기 권한으로는 수정할 수 없습니다.");
  }
  return u;
}

export const canEdit = (u: CurrentUser) => RANK[u.role] >= RANK.editor;

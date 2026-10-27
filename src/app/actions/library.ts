"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { run, UserError } from "@/lib/result";

const refresh = () => revalidatePath("/", "layout");

export async function addLink(input: { name: string; url: string; projectId?: string | null; category?: string; note?: string }) {
  return run(async () => {
    const me = await assertRole("editor");
    const url = input.url.trim();
    if (!/^https?:\/\//i.test(url)) throw new UserError("http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.");
    await db.insert(schema.files).values({
      kind: "link", name: input.name.trim() || url, url, projectId: input.projectId || null,
      category: input.category?.trim() || null, note: input.note?.trim() || null, uploadedBy: me.id,
    });
    refresh();
    return null;
  });
}

export async function updateFileMeta(id: string, patch: { name?: string; category?: string | null; note?: string | null; projectId?: string | null }) {
  return run(async () => {
    await assertRole("editor");
    const set: Partial<typeof schema.files.$inferInsert> = {};
    if (patch.name !== undefined) set.name = patch.name.trim() || "이름 없음";
    if (patch.category !== undefined) set.category = patch.category?.trim() || null;
    if (patch.note !== undefined) set.note = patch.note?.trim() || null;
    if (patch.projectId !== undefined) set.projectId = patch.projectId || null;
    await db.update(schema.files).set(set).where(eq(schema.files.id, id));
    refresh();
    return null;
  });
}

export async function deleteFile(id: string) {
  return run(async () => {
    await assertRole("editor");
    const [f] = await db.select().from(schema.files).where(eq(schema.files.id, id)).limit(1);
    if (!f) return null;
    await db.delete(schema.files).where(eq(schema.files.id, id)); // 청크는 cascade 삭제
    refresh();
    return null;
  });
}

export async function createDoc(input: { title: string; folder?: string; projectId?: string | null }) {
  return run(async () => {
    const me = await assertRole("editor");
    const title = input.title.trim();
    if (!title) throw new UserError("문서 제목을 입력해 주세요.");
    const [d] = await db.insert(schema.docs).values({
      title, folder: input.folder?.trim() || "일반", projectId: input.projectId || null, updatedBy: me.id,
      content: `# ${title}\n\n`,
    }).returning({ id: schema.docs.id });
    refresh();
    return { id: d.id };
  });
}

/** 위키 문서 저장 — 다른 사람이 먼저 저장했으면 덮어쓰지 않고 충돌로 알림 */
export async function saveDoc(id: string, expectedVersion: number, patch: { title: string; folder: string; content: string; projectId: string | null }) {
  return run(async () => {
    const me = await assertRole("editor");
    if (!patch.title.trim()) throw new UserError("문서 제목을 입력해 주세요.");
    const updated = await db.update(schema.docs).set({
      title: patch.title.trim(), folder: patch.folder.trim() || "일반", content: patch.content,
      projectId: patch.projectId || null, updatedBy: me.id, updatedAt: new Date(),
      version: sql`${schema.docs.version} + 1`,
    }).where(and(eq(schema.docs.id, id), eq(schema.docs.version, expectedVersion))).returning({ version: schema.docs.version });
    if (!updated.length) throw new UserError("다른 팀원이 먼저 이 문서를 저장했습니다. 내 변경 내용을 복사해 두고 새로고침하세요.");
    refresh();
    return { version: updated[0].version };
  });
}

export async function deleteDoc(id: string) {
  return run(async () => {
    await assertRole("editor");
    await db.delete(schema.docs).where(eq(schema.docs.id, id));
    refresh();
    return null;
  });
}

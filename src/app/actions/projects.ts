"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { run, UserError } from "@/lib/result";
import { logActivity } from "@/lib/audit";

const refresh = () => revalidatePath("/", "layout");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createProject(fd: FormData) {
  const me = await assertRole("editor");
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  const description = String(fd.get("description") ?? "").trim() || null;
  const launch = String(fd.get("launchDate") ?? "");
  const [p] = await db.insert(schema.projects).values({
    title, description, launchDate: DATE_RE.test(launch) ? launch : null,
  }).returning();
  await logActivity(me.id, "project", "project_create", { label: p.title, projectId: p.id, targetId: p.id });
  refresh();
  redirect(`/projects/${p.id}`);
}

/** 프로젝트 이름만 변경 (참여 로그에 '이전 → 새 이름'으로 남김) */
export async function renameProject(id: string, title: string) {
  return run(async () => {
    const me = await assertRole("editor");
    const next = title.trim();
    if (!next) throw new UserError("프로젝트 이름을 입력해 주세요.");
    if (next.length > 100) throw new UserError("프로젝트 이름은 100자 이내로 입력해 주세요.");
    const [p] = await db.select({ title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
    if (!p) throw new UserError("프로젝트를 찾을 수 없습니다.");
    if (p.title === next) return null;
    await db.update(schema.projects).set({ title: next }).where(eq(schema.projects.id, id));
    await logActivity(me.id, "project", "project_rename", { label: `${p.title} → ${next}`, projectId: id, targetId: id });
    refresh();
    return null;
  });
}

export async function updateProject(id: string, patch: { title?: string; description?: string | null; launchDate?: string | null; archived?: boolean }) {
  return run(async () => {
    const me = await assertRole("editor");
    const set: Partial<typeof schema.projects.$inferInsert> = {};
    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw new UserError("프로젝트 이름을 입력해 주세요.");
      set.title = patch.title.trim();
    }
    if (patch.description !== undefined) set.description = patch.description?.trim() || null;
    if (patch.launchDate !== undefined) set.launchDate = patch.launchDate && DATE_RE.test(patch.launchDate) ? patch.launchDate : null;
    if (patch.archived !== undefined) set.archived = patch.archived;
    const [before] = await db.select({ title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
    await db.update(schema.projects).set(set).where(eq(schema.projects.id, id));
    if (set.title && before && before.title !== set.title) {
      await logActivity(me.id, "project", "project_rename", { label: `${before.title} → ${set.title}`, projectId: id, targetId: id });
    }
    if (patch.archived || patch.description !== undefined || patch.launchDate !== undefined) {
      await logActivity(me.id, "project", patch.archived ? "project_archive" : "project_update", { label: set.title ?? before?.title ?? null, projectId: id, targetId: id });
    }
    refresh();
    return null;
  });
}

export async function deleteProject(id: string) {
  return run(async () => {
    const me = await assertRole("admin");
    const [p] = await db.select({ title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.id, id));
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
    await logActivity(me.id, "project", "project_delete", { label: p?.title ?? null });
    refresh();
    return null;
  });
}

export type MilestoneInput = { id?: string; title: string; date: string; done: boolean };

/** 마일스톤 목록을 통째로 저장 (진척도 카드의 편집 창에서 사용) */
export async function saveMilestones(projectId: string, items: MilestoneInput[]) {
  return run(async () => {
    await assertRole("editor");
    for (const m of items) {
      if (!m.title.trim()) throw new UserError("마일스톤 이름을 입력해 주세요.");
      if (!DATE_RE.test(m.date)) throw new UserError(`'${m.title}'의 날짜를 입력해 주세요.`);
    }
    const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
    await db.transaction(async (tx) => {
      await tx.delete(schema.milestones).where(eq(schema.milestones.projectId, projectId));
      if (sorted.length) {
        await tx.insert(schema.milestones).values(sorted.map((m, i) => ({
          projectId, title: m.title.trim(), date: m.date, done: m.done, sortOrder: i,
        })));
      }
    });
    refresh();
    return null;
  });
}

/** 분류 묶음(대분류) 통째로 저장 */
export async function saveCategories(projectId: string, categories: { name: string; subtitles: string[] }[]) {
  return run(async () => {
    const me = await assertRole("editor");
    const seen = new Set<string>();
    const clean = categories.map((c, i) => {
      const name = c.name.trim() || `대분류 ${i + 1}`;
      if (seen.has(name)) throw new UserError(`대분류 이름 '${name}'이(가) 중복됩니다.`);
      seen.add(name);
      if (name.length > 40) throw new UserError("대분류 이름은 40자 이내로 입력해 주세요.");
      return { name, subtitles: [...new Set(c.subtitles.map((s) => s.trim()).filter(Boolean))] };
    });
    await db.transaction(async (tx) => {
      await tx.delete(schema.subtitleGroups).where(eq(schema.subtitleGroups.projectId, projectId));
      if (clean.length) await tx.insert(schema.subtitleGroups).values(clean.map((c, i) => ({ projectId, name: c.name, subtitles: c.subtitles, sortOrder: i })));
    });
    await logActivity(me.id, "project", "project_update", { label: `분류 묶음 ${clean.length}개`, projectId, targetId: projectId });
    refresh();
    return null;
  });
}

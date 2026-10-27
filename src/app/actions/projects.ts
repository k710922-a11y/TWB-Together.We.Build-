"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { run, UserError } from "@/lib/result";

const refresh = () => revalidatePath("/", "layout");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createProject(fd: FormData) {
  await assertRole("editor");
  const title = String(fd.get("title") ?? "").trim();
  if (!title) return;
  const description = String(fd.get("description") ?? "").trim() || null;
  const launch = String(fd.get("launchDate") ?? "");
  const [p] = await db.insert(schema.projects).values({
    title, description, launchDate: DATE_RE.test(launch) ? launch : null,
  }).returning();
  refresh();
  redirect(`/projects/${p.id}`);
}

export async function updateProject(id: string, patch: { title?: string; description?: string | null; launchDate?: string | null; archived?: boolean }) {
  return run(async () => {
    await assertRole("editor");
    const set: Partial<typeof schema.projects.$inferInsert> = {};
    if (patch.title !== undefined) {
      if (!patch.title.trim()) throw new UserError("프로젝트 이름을 입력해 주세요.");
      set.title = patch.title.trim();
    }
    if (patch.description !== undefined) set.description = patch.description?.trim() || null;
    if (patch.launchDate !== undefined) set.launchDate = patch.launchDate && DATE_RE.test(patch.launchDate) ? patch.launchDate : null;
    if (patch.archived !== undefined) set.archived = patch.archived;
    await db.update(schema.projects).set(set).where(eq(schema.projects.id, id));
    refresh();
    return null;
  });
}

export async function deleteProject(id: string) {
  return run(async () => {
    await assertRole("admin");
    await db.delete(schema.projects).where(eq(schema.projects.id, id));
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

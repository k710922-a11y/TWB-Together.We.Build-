"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, max, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { run, UserError, type Result } from "@/lib/result";
import { PRIORITIES, STATUSES, STATUS_LABEL, PRIORITY_LABEL, type Priority, type Status } from "@/lib/format";

const refresh = () => revalidatePath("/", "layout");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function cleanDate(v: string | null | undefined) {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  if (!DATE_RE.test(v)) throw new UserError("날짜 형식이 올바르지 않습니다.");
  return v;
}

export type TaskInput = {
  projectId: string;
  title: string;
  parentId?: string | null;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

export async function createTask(input: TaskInput) {
  return run(async () => {
    const me = await assertRole("editor");
    const title = input.title.trim();
    if (!title) throw new UserError("태스크 이름을 입력해 주세요.");
    if (input.parentId) {
      const [parent] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, input.parentId)).limit(1);
      if (!parent) throw new UserError("상위 태스크를 찾을 수 없습니다.");
      if (parent.parentId) throw new UserError("서브태스크 아래에는 다시 서브태스크를 만들 수 없습니다.");
    }
    const [{ m }] = await db.select({ m: max(schema.tasks.sortOrder) }).from(schema.tasks)
      .where(eq(schema.tasks.projectId, input.projectId));
    const [t] = await db.insert(schema.tasks).values({
      projectId: input.projectId,
      parentId: input.parentId ?? null,
      title,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigneeId: input.assigneeId ?? null,
      startDate: cleanDate(input.startDate) ?? null,
      dueDate: cleanDate(input.dueDate) ?? null,
      sortOrder: (m ?? 0) + 1,
      createdBy: me.id,
    }).returning();
    await db.insert(schema.taskActivity).values({ taskId: t.id, userId: me.id, action: "created", detail: { title } });
    refresh();
    return { id: t.id };
  });
}

export type TaskPatch = {
  title?: string;
  description?: string | null;
  status?: Status;
  priority?: Priority;
  assigneeId?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
};

/**
 * 태스크 수정 (테이블 인라인 편집·칸반 이동·상세 패널 공용)
 * expectedVersion이 DB의 version과 다르면 다른 팀원이 먼저 수정한 것이므로 충돌을 돌려준다.
 */
export async function updateTask(id: string, expectedVersion: number, patch: TaskPatch): Promise<Result<{ version: number }>> {
  const res = await run(async () => {
    const me = await assertRole("editor");
    const set: Partial<typeof schema.tasks.$inferInsert> = {};
    if (patch.title !== undefined) {
      const t = patch.title.trim();
      if (!t) throw new UserError("태스크 이름은 비울 수 없습니다.");
      set.title = t;
    }
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.status !== undefined) {
      if (!STATUSES.includes(patch.status)) throw new UserError("상태 값이 올바르지 않습니다.");
      set.status = patch.status;
    }
    if (patch.priority !== undefined) {
      if (!PRIORITIES.includes(patch.priority)) throw new UserError("우선순위 값이 올바르지 않습니다.");
      set.priority = patch.priority;
    }
    if (patch.assigneeId !== undefined) set.assigneeId = patch.assigneeId || null;
    if (patch.startDate !== undefined) set.startDate = cleanDate(patch.startDate);
    if (patch.dueDate !== undefined) set.dueDate = cleanDate(patch.dueDate);

    const [before] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, id)).limit(1);
    if (!before) throw new UserError("태스크가 삭제되었습니다.");
    const start = set.startDate !== undefined ? set.startDate : before.startDate;
    const due = set.dueDate !== undefined ? set.dueDate : before.dueDate;
    if (start && due && start > due) throw new UserError("시작일이 마감일보다 늦을 수 없습니다.");

    const updated = await db.update(schema.tasks)
      .set({ ...set, version: sql`${schema.tasks.version} + 1`, updatedAt: new Date() })
      .where(and(eq(schema.tasks.id, id), eq(schema.tasks.version, expectedVersion)))
      .returning({ version: schema.tasks.version });
    if (updated.length === 0) return { conflict: true as const };

    // 변경 이력 기록
    const logs: { action: string; detail: Record<string, unknown> }[] = [];
    if (set.status && set.status !== before.status)
      logs.push({ action: "status", detail: { from: STATUS_LABEL[before.status as Status], to: STATUS_LABEL[set.status as Status] } });
    if (set.assigneeId !== undefined && set.assigneeId !== before.assigneeId) {
      let to = "미배정";
      if (set.assigneeId) {
        const [u] = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.id, set.assigneeId));
        to = u?.name ?? "알 수 없음";
      }
      logs.push({ action: "assignee", detail: { to } });
    }
    if (set.dueDate !== undefined && set.dueDate !== before.dueDate) logs.push({ action: "due", detail: { to: set.dueDate } });
    if (set.startDate !== undefined && set.startDate !== before.startDate) logs.push({ action: "start", detail: { to: set.startDate } });
    if (set.priority && set.priority !== before.priority)
      logs.push({ action: "priority", detail: { to: PRIORITY_LABEL[set.priority as Priority] } });
    if (set.title && set.title !== before.title) logs.push({ action: "title", detail: { to: set.title } });
    if (logs.length) await db.insert(schema.taskActivity).values(logs.map((l) => ({ taskId: id, userId: me.id, ...l })));

    refresh();
    return { conflict: false as const, version: updated[0].version };
  });
  if (!res.ok) return res;
  if (res.data.conflict) {
    refresh();
    return { ok: false, conflict: true, error: "다른 팀원이 먼저 수정했습니다. 최신 내용으로 새로고침했어요." };
  }
  return { ok: true, data: { version: res.data.version } };
}

export async function deleteTask(id: string) {
  return run(async () => {
    await assertRole("editor");
    await db.transaction(async (tx) => {
      await tx.delete(schema.tasks).where(eq(schema.tasks.parentId, id));
      await tx.delete(schema.tasks).where(eq(schema.tasks.id, id));
    });
    refresh();
    return null;
  });
}

export async function addComment(taskId: string, content: string) {
  return run(async () => {
    const me = await assertRole("viewer"); // 보기 권한도 의견은 남길 수 있음
    const text = content.trim();
    if (!text) throw new UserError("댓글 내용을 입력해 주세요.");
    await db.insert(schema.comments).values({ taskId, userId: me.id, content: text });
    refresh();
    return null;
  });
}

export async function deleteComment(id: string) {
  return run(async () => {
    const me = await assertRole("viewer");
    const [c] = await db.select().from(schema.comments).where(eq(schema.comments.id, id)).limit(1);
    if (!c) return null;
    if (c.userId !== me.id && me.role !== "admin") throw new UserError("본인 댓글만 삭제할 수 있습니다.");
    await db.delete(schema.comments).where(eq(schema.comments.id, id));
    refresh();
    return null;
  });
}

/** 선행 태스크 지정 (간트 의존 관계). 순환 의존은 막는다. */
export async function setDependencies(taskId: string, dependsOnIds: string[]) {
  return run(async () => {
    const me = await assertRole("editor");
    const ids = [...new Set(dependsOnIds)].filter((x) => x !== taskId);
    const [task] = await db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
    if (!task) throw new UserError("태스크를 찾을 수 없습니다.");
    // 같은 프로젝트 전체 의존 그래프에서 순환 검사
    const all = await db.select({ taskId: schema.taskDependencies.taskId, dep: schema.taskDependencies.dependsOnId })
      .from(schema.taskDependencies)
      .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskDependencies.taskId))
      .where(eq(schema.tasks.projectId, task.projectId));
    const graph = new Map<string, string[]>();
    for (const e of all) if (e.taskId !== taskId) graph.set(e.taskId, [...(graph.get(e.taskId) ?? []), e.dep]);
    graph.set(taskId, ids);
    const reaches = (from: string, target: string, seen = new Set<string>()): boolean => {
      if (from === target) return true;
      if (seen.has(from)) return false;
      seen.add(from);
      return (graph.get(from) ?? []).some((n) => reaches(n, target, seen));
    };
    for (const d of ids) if (reaches(d, taskId)) throw new UserError("순환 의존이 생겨 지정할 수 없습니다.");

    await db.transaction(async (tx) => {
      await tx.delete(schema.taskDependencies).where(eq(schema.taskDependencies.taskId, taskId));
      if (ids.length) await tx.insert(schema.taskDependencies).values(ids.map((d) => ({ taskId, dependsOnId: d })));
    });
    if (ids.length) {
      const names = await db.select({ title: schema.tasks.title }).from(schema.tasks).where(inArray(schema.tasks.id, ids));
      await db.insert(schema.taskActivity).values({ taskId, userId: me.id, action: "deps", detail: { to: names.map((n) => n.title).join(", ") } });
    }
    refresh();
    return null;
  });
}

/** 칸반/테이블에서 순서 변경 */
export async function reorderTasks(orderedIds: string[]) {
  return run(async () => {
    await assertRole("editor");
    await db.transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.update(schema.tasks).set({ sortOrder: i + 1 }).where(eq(schema.tasks.id, orderedIds[i]));
      }
    });
    refresh();
    return null;
  });
}

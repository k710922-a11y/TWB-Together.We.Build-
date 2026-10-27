import "server-only";
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db, schema } from "./db";
import { todayStr, type Priority, type Status } from "./format";

export type UserLite = { id: string; name: string; color: string; role: string; active: boolean; online: boolean; email: string };

export async function listUsers(): Promise<UserLite[]> {
  const rows = await db.select().from(schema.users).orderBy(asc(schema.users.createdAt));
  return rows.map((u) => ({
    id: u.id, name: u.name, color: u.color, role: u.role, active: u.active, email: u.email,
    online: !!u.lastSeenAt && Date.now() - u.lastSeenAt.getTime() < 5 * 60_000,
  }));
}

export type TaskRow = {
  id: string; projectId: string; parentId: string | null; title: string; description: string | null;
  status: Status; priority: Priority; assigneeId: string | null; startDate: string | null; dueDate: string | null;
  sortOrder: number; version: number; source: string; meetingId: string | null; createdAt: string;
};

const taskCols = {
  id: schema.tasks.id, projectId: schema.tasks.projectId, parentId: schema.tasks.parentId, title: schema.tasks.title,
  description: schema.tasks.description, status: schema.tasks.status, priority: schema.tasks.priority,
  assigneeId: schema.tasks.assigneeId, startDate: schema.tasks.startDate, dueDate: schema.tasks.dueDate,
  sortOrder: schema.tasks.sortOrder, version: schema.tasks.version, source: schema.tasks.source,
  meetingId: schema.tasks.meetingId, createdAt: schema.tasks.createdAt,
};
const toRow = (t: { createdAt: Date } & Omit<TaskRow, "createdAt" | "status" | "priority"> & { status: string; priority: string }): TaskRow =>
  ({ ...t, status: t.status as Status, priority: t.priority as Priority, createdAt: t.createdAt.toISOString() });

export async function projectTasks(projectId: string): Promise<TaskRow[]> {
  const rows = await db.select(taskCols).from(schema.tasks).where(eq(schema.tasks.projectId, projectId))
    .orderBy(asc(schema.tasks.sortOrder), asc(schema.tasks.createdAt));
  return rows.map(toRow);
}

export async function projectDeps(projectId: string) {
  return db.select({ taskId: schema.taskDependencies.taskId, dependsOnId: schema.taskDependencies.dependsOnId })
    .from(schema.taskDependencies)
    .innerJoin(schema.tasks, eq(schema.tasks.id, schema.taskDependencies.taskId))
    .where(eq(schema.tasks.projectId, projectId));
}

export type Progress = { total: number; done: number; inProgress: number; delayed: number; percent: number };

/** 진척도: 최상위 태스크 기준. 서브태스크가 있으면 서브태스크 완료 비율만큼 부분 점수 */
export function computeProgress(tasks: TaskRow[]): Progress {
  const today = todayStr();
  const tops = tasks.filter((t) => !t.parentId);
  let score = 0;
  for (const t of tops) {
    const subs = tasks.filter((s) => s.parentId === t.id);
    if (t.status === "done") score += 1;
    else if (subs.length) score += subs.filter((s) => s.status === "done").length / subs.length;
  }
  return {
    total: tops.length,
    done: tops.filter((t) => t.status === "done").length,
    inProgress: tops.filter((t) => t.status === "in_progress" || t.status === "review").length,
    delayed: tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate < today).length,
    percent: tops.length ? Math.round((score / tops.length) * 100) : 0,
  };
}

export async function listProjects() {
  const projects = await db.select().from(schema.projects).where(eq(schema.projects.archived, false)).orderBy(asc(schema.projects.createdAt));
  if (!projects.length) return [];
  const tasks = (await db.select(taskCols).from(schema.tasks).where(inArray(schema.tasks.projectId, projects.map((p) => p.id)))).map(toRow);
  return projects.map((p) => ({ ...p, progress: computeProgress(tasks.filter((t) => t.projectId === p.id)) }));
}

export async function myOpenTasks(userId: string) {
  const rows = await db.select({ ...taskCols, projectTitle: schema.projects.title }).from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(and(eq(schema.tasks.assigneeId, userId), ne(schema.tasks.status, "done"), eq(schema.projects.archived, false)))
    .orderBy(sql`${schema.tasks.dueDate} asc nulls last`, asc(schema.tasks.createdAt));
  return rows.map((r) => ({ ...toRow(r), projectTitle: r.projectTitle }));
}

export async function dueSoonTasks(days = 7) {
  const today = todayStr();
  const rows = await db.select({ ...taskCols, projectTitle: schema.projects.title }).from(schema.tasks)
    .innerJoin(schema.projects, eq(schema.projects.id, schema.tasks.projectId))
    .where(and(ne(schema.tasks.status, "done"), eq(schema.projects.archived, false),
      sql`${schema.tasks.dueDate} <= (${today}::date + ${days}::int)`))
    .orderBy(asc(schema.tasks.dueDate)).limit(30);
  return rows.map((r) => ({ ...toRow(r), projectTitle: r.projectTitle }));
}

export async function taskDetail(taskId: string) {
  const [t] = await db.select(taskCols).from(schema.tasks).where(eq(schema.tasks.id, taskId)).limit(1);
  if (!t) return null;
  const comments = await db.select({
    id: schema.comments.id, content: schema.comments.content, createdAt: schema.comments.createdAt,
    userId: schema.comments.userId, userName: schema.users.name, userColor: schema.users.color,
  }).from(schema.comments).leftJoin(schema.users, eq(schema.users.id, schema.comments.userId))
    .where(eq(schema.comments.taskId, taskId)).orderBy(asc(schema.comments.createdAt));
  const activity = await db.select({
    id: schema.taskActivity.id, action: schema.taskActivity.action, detail: schema.taskActivity.detail,
    createdAt: schema.taskActivity.createdAt, userName: schema.users.name,
  }).from(schema.taskActivity).leftJoin(schema.users, eq(schema.users.id, schema.taskActivity.userId))
    .where(eq(schema.taskActivity.taskId, taskId)).orderBy(desc(schema.taskActivity.createdAt)).limit(50);
  let meeting: { id: string; title: string } | null = null;
  if (t.meetingId) {
    const [m] = await db.select({ id: schema.meetings.id, title: schema.meetings.title }).from(schema.meetings).where(eq(schema.meetings.id, t.meetingId));
    meeting = m ?? null;
  }
  return {
    task: toRow(t),
    comments: comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })),
    activity: activity.map((a) => ({ ...a, createdAt: a.createdAt.toISOString() })),
    meeting,
  };
}
export type TaskDetail = NonNullable<Awaited<ReturnType<typeof taskDetail>>>;

export async function boardPosts(limit = 30) {
  const posts = await db.select({
    id: schema.posts.id, content: schema.posts.content, isNotice: schema.posts.isNotice, createdAt: schema.posts.createdAt,
    userId: schema.posts.userId, userName: schema.users.name, userColor: schema.users.color,
    fileId: schema.posts.fileId, fileName: schema.files.name,
  }).from(schema.posts)
    .leftJoin(schema.users, eq(schema.users.id, schema.posts.userId))
    .leftJoin(schema.files, eq(schema.files.id, schema.posts.fileId))
    .orderBy(desc(schema.posts.isNotice), desc(schema.posts.createdAt)).limit(limit);
  if (!posts.length) return [];
  const ids = posts.map((p) => p.id);
  const replies = await db.select({
    id: schema.postReplies.id, postId: schema.postReplies.postId, content: schema.postReplies.content,
    createdAt: schema.postReplies.createdAt, userName: schema.users.name,
  }).from(schema.postReplies).leftJoin(schema.users, eq(schema.users.id, schema.postReplies.userId))
    .where(inArray(schema.postReplies.postId, ids)).orderBy(asc(schema.postReplies.createdAt));
  const likes = await db.select().from(schema.postLikes).where(inArray(schema.postLikes.postId, ids));
  return posts.map((p) => ({
    ...p, createdAt: p.createdAt.toISOString(),
    replies: replies.filter((r) => r.postId === p.id).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    likes: likes.filter((l) => l.postId === p.id).map((l) => l.userId),
  }));
}
export type BoardPost = Awaited<ReturnType<typeof boardPosts>>[number];

export async function pendingInvites() {
  return db.select().from(schema.invites).where(isNull(schema.invites.acceptedAt)).orderBy(desc(schema.invites.createdAt));
}

export async function listMeetings(projectId?: string) {
  const rows = await db.select({
    id: schema.meetings.id, title: schema.meetings.title, heldOn: schema.meetings.heldOn, durationMin: schema.meetings.durationMin,
    status: schema.meetings.status, projectId: schema.meetings.projectId, projectTitle: schema.projects.title,
    summary: schema.meetings.summary, createdAt: schema.meetings.createdAt,
  }).from(schema.meetings).leftJoin(schema.projects, eq(schema.projects.id, schema.meetings.projectId))
    .where(projectId ? eq(schema.meetings.projectId, projectId) : undefined)
    .orderBy(desc(schema.meetings.heldOn), desc(schema.meetings.createdAt));
  return rows;
}

export async function meetingDetail(id: string) {
  const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id)).limit(1);
  if (!m) return null;
  const tasks = (await db.select(taskCols).from(schema.tasks).where(eq(schema.tasks.meetingId, id)).orderBy(asc(schema.tasks.sortOrder))).map(toRow);
  const [project] = m.projectId ? await db.select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.id, m.projectId)) : [];
  // 원격 업로드 주소 등 민감 필드는 화면으로 보내지 않음
  const { uploadUrl: _u, geminiFileUri: _g, lockedUntil: _l, ...safe } = m;
  void _u; void _g; void _l;
  return { meeting: { ...safe, createdAt: m.createdAt.toISOString() }, tasks, project: project ?? null };
}
export type MeetingDetail = NonNullable<Awaited<ReturnType<typeof meetingDetail>>>;

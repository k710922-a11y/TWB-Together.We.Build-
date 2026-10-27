import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import clsx from "clsx";
import { db, schema } from "@/lib/db";
import { canEdit, requireUser } from "@/lib/auth";
import { computeProgress, listMeetings, listUsers, meetingDetail, projectDeps, projectTasks, taskDetail } from "@/lib/queries";
import { ProgressCard } from "@/components/project/ProgressCard";
import { ProjectHeader } from "@/components/project/ProjectHeader";
import { TaskTable } from "@/components/project/TaskTable";
import { Kanban } from "@/components/project/Kanban";
import { Gantt } from "@/components/project/Gantt";
import { ProjectDashboard } from "@/components/project/ProjectDashboard";
import { ProjectMeetings } from "@/components/project/ProjectMeetings";
import { TaskPanel } from "@/components/project/TaskPanel";
import type { Priority, Status } from "@/lib/format";

export const dynamic = "force-dynamic";
// 미팅 탭에서 녹음 처리 단계(서버 액션)가 이 페이지 기준으로 실행되므로 실행 시간 상한을 늘림
export const maxDuration = 300;

const TABS = [
  { key: "table", label: "테이블" },
  { key: "kanban", label: "칸반" },
  { key: "gantt", label: "간트" },
  { key: "meetings", label: "미팅 로그" },
  { key: "dashboard", label: "대시보드" },
] as const;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p] = await db.select({ title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.id, id));
  return { title: p?.title ?? "프로젝트" };
}

export default async function ProjectPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [project] = await db.select().from(schema.projects).where(eq(schema.projects.id, id)).limit(1);
  if (!project) notFound();

  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? "table") as (typeof TABS)[number]["key"];
  const [tasks, users, milestones, deps, meetings, detail] = await Promise.all([
    projectTasks(id), listUsers(),
    db.select().from(schema.milestones).where(eq(schema.milestones.projectId, id)).orderBy(asc(schema.milestones.date)),
    projectDeps(id),
    tab === "meetings" ? listMeetings(id) : Promise.resolve([]),
    sp.task && /^[0-9a-f-]{36}$/i.test(sp.task) ? taskDetail(sp.task) : Promise.resolve(null),
  ]);

  // 필터 (담당자·상태·우선순위)
  const filters = { assignee: sp.assignee ?? "", status: sp.status ?? "", priority: sp.priority ?? "" };
  const match = (t: (typeof tasks)[number]) =>
    (!filters.assignee || (filters.assignee === "none" ? !t.assigneeId : t.assigneeId === filters.assignee)) &&
    (!filters.status || t.status === (filters.status as Status)) &&
    (!filters.priority || t.priority === (filters.priority as Priority));
  const filtered = filters.assignee || filters.status || filters.priority
    ? tasks.filter((t) => match(t) || tasks.some((s) => s.parentId === t.id && match(s)))
    : tasks;

  const selectedMeetingId = tab === "meetings" ? (sp.meeting && /^[0-9a-f-]{36}$/i.test(sp.meeting) ? sp.meeting : meetings[0]?.id) : undefined;
  const selectedMeeting = selectedMeetingId ? await meetingDetail(selectedMeetingId) : null;
  const editable = canEdit(me);
  const progress = computeProgress(tasks);
  const tabHref = (k: string) => {
    const q = new URLSearchParams();
    q.set("tab", k);
    for (const [kk, v] of Object.entries(filters)) if (v) q.set(kk, v);
    return `/projects/${id}?${q.toString()}`;
  };
  const activeUsers = users.filter((u) => u.active);

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-6 lg:px-8">
        <ProjectHeader project={{ id: project.id, title: project.title, description: project.description, launchDate: project.launchDate }}
          users={activeUsers} filters={filters} editable={editable} isAdmin={me.role === "admin"} />
        <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <Link key={t.key} href={tabHref(t.key)} scroll={false}
              className={clsx("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[14px]", tab === t.key ? "border-brand font-semibold text-brand" : "border-transparent text-sub hover:text-ink")}>
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="space-y-6 px-5 py-6 lg:px-8">
        <ProgressCard projectId={id} title={project.title} launchDate={project.launchDate} progress={progress}
          milestones={milestones.map((m) => ({ id: m.id, title: m.title, date: m.date, done: m.done }))} editable={editable} />

        {tab === "table" && <TaskTable projectId={id} tasks={filtered} users={activeUsers} editable={editable} />}
        {tab === "kanban" && <Kanban projectId={id} tasks={filtered.filter((t) => !t.parentId)} allTasks={tasks} users={activeUsers} editable={editable} />}
        {tab === "gantt" && <Gantt tasks={filtered.filter((t) => !t.parentId)} deps={deps} milestones={milestones.map((m) => ({ title: m.title, date: m.date }))} />}
        {tab === "meetings" && <ProjectMeetings key={selectedMeeting?.meeting.id ?? "none"} projectId={id} meetings={meetings} selected={selectedMeeting} users={activeUsers} editable={editable} />}
        {tab === "dashboard" && <ProjectDashboard tasks={tasks} users={activeUsers} />}
      </div>

      {detail && detail.task.projectId === id && (
        <TaskPanel detail={detail} tasks={tasks} deps={deps} users={activeUsers} me={me} editable={editable} />
      )}
    </div>
  );
}

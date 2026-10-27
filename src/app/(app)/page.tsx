import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { dueSoonTasks, listMeetings, listProjects, listUsers, myOpenTasks } from "@/lib/queries";
import { TaskListRows } from "@/components/pages/TaskListRows";
import { Empty } from "@/components/ui";
import { DeleteProjectButton } from "@/components/pages/DeleteProjectButton";
import { fmtKoDate } from "@/lib/format";
import { geminiReady } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const metadata = { title: "홈" };

export default async function Home() {
  const me = await requireUser();
  const [projects, mine, soon, users, meetings] = await Promise.all([listProjects(), myOpenTasks(me.id), dueSoonTasks(7), listUsers(), listMeetings()]);
  return (
    <div className="space-y-6 px-5 py-7 lg:px-8">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">안녕하세요, {me.name}님</h1>
        <p className="mt-1 text-[13px] text-sub">내 할 일 {mine.length}건 · 7일 내 마감 {soon.length}건</p>
      </div>
      {me.role === "admin" && !geminiReady() && (
        <div className="rounded-xl border border-[#f6d38a] bg-[#fff8ec] px-4 py-3 text-[13px] text-[#8a5200]">
          미팅 녹음 정리(Gemini)가 아직 꺼져 있습니다. Vercel 프로젝트 환경 변수에 <b>GEMINI_API_KEY</b>를 넣으면 켜집니다. (aistudio.google.com/apikey 에서 무료 발급)
        </div>
      )}

      <section>
        <div className="mb-2.5 flex items-center justify-between"><h2 className="text-[16px] font-bold">프로젝트 진척도</h2><Link href="/projects" className="text-[13px] text-brand">전체 보기</Link></div>
        {projects.length === 0 ? <Empty>프로젝트가 없습니다. <Link href="/projects" className="text-brand">새 프로젝트 만들기</Link></Empty> : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <article key={p.id} className="card relative hover:border-brand/40">
                <Link href={`/projects/${p.id}`} className={`block rounded-xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${me.role === "admin" ? "pr-14" : ""}`}>
                  <div className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-[14.5px] font-bold">{p.title}</span><span className="shrink-0 text-[13px] font-bold text-brand">{p.progress.percent}%</span></div>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full" style={{ width: `${p.progress.percent}%`, background: "linear-gradient(90deg,#6c5cf5,#4f8df7)" }} /></div>
                  <div className="mt-2 text-[12px] text-sub">완료 {p.progress.done}/{p.progress.total} · 진행 중 {p.progress.inProgress} · 지연 {p.progress.delayed}{p.launchDate ? ` · 오픈 ${fmtKoDate(p.launchDate)}` : ""}</div>
                </Link>
              {me.role === "admin" && <div className="absolute right-3 top-3"><DeleteProjectButton projectId={p.id} projectTitle={p.title} /></div>}
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between bg-brand px-4 py-3 text-white"><h2 className="text-[15px] font-bold">내 할 일</h2><Link href="/my" className="rounded text-[12.5px] font-medium text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">전체</Link></div>
          {mine.length ? <TaskListRows tasks={mine.slice(0, 8)} /> : <p className="px-4 py-6 text-[13px] text-sub">맡은 일이 없습니다.</p>}
        </section>
        <section className="card overflow-hidden">
          <div className="bg-brand px-4 py-3 text-white"><h2 className="text-[15px] font-bold">마감 임박 · 지연</h2></div>
          {soon.length ? <TaskListRows tasks={soon.slice(0, 8)} users={users} showAssignee /> : <p className="px-4 py-6 text-[13px] text-sub">일주일 안에 마감되는 일이 없습니다.</p>}
        </section>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between bg-brand px-4 py-3 text-white"><h2 className="text-[15px] font-bold">최근 미팅</h2><Link href="/meetings" className="rounded text-[12.5px] font-medium text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">전체</Link></div>
        {meetings.length ? (
          <ul className="divide-y divide-line">
            {meetings.slice(0, 5).map((m) => (
              <li key={m.id}><Link href={`/meetings/${m.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
                <span className="w-[68px] text-[12.5px] text-sub">{fmtKoDate(m.heldOn)}</span>
                <span className="flex-1 truncate text-[13.5px] font-medium">{m.title}</span>
                <span className="truncate text-[12px] text-faint">{m.projectTitle}</span>
              </Link></li>
            ))}
          </ul>
        ) : <p className="px-4 py-6 text-[13px] text-sub">기록된 미팅이 없습니다.</p>}
      </section>
    </div>
  );
}

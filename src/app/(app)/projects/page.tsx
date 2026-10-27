import Link from "next/link";
import { canEdit, requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/queries";
import { createProject } from "@/app/actions/projects";
import { Empty } from "@/components/ui";
import { fmtKoDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "프로젝트" };

export default async function Projects() {
  const me = await requireUser();
  const projects = await listProjects();
  return (
    <div className="space-y-6 px-5 py-7 lg:px-8">
      <h1 className="text-[24px] font-bold tracking-tight">프로젝트</h1>
      {projects.length === 0 && <Empty>아직 프로젝트가 없습니다.</Empty>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`} className="card block p-5 hover:border-brand/40">
            <div className="flex items-center justify-between gap-2"><span className="truncate text-[15px] font-bold">{p.title}</span><span className="font-bold text-brand">{p.progress.percent}%</span></div>
            {p.description && <p className="mt-1 line-clamp-2 text-[12.5px] text-sub">{p.description}</p>}
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas"><div className="h-full rounded-full" style={{ width: `${p.progress.percent}%`, background: "linear-gradient(90deg,#6c5cf5,#4f8df7)" }} /></div>
            <div className="mt-2 text-[12px] text-sub">태스크 {p.progress.total} · 지연 {p.progress.delayed}{p.launchDate ? ` · 오픈 목표 ${fmtKoDate(p.launchDate)}` : ""}</div>
          </Link>
        ))}
      </div>
      {canEdit(me) && (
        <form action={createProject} className="card max-w-xl space-y-3 p-5">
          <h2 className="text-[15px] font-bold">새 프로젝트</h2>
          <input name="title" required className="input" placeholder="프로젝트 이름 (예: K-thang MVP)" />
          <input name="description" className="input" placeholder="한 줄 설명 (선택)" />
          <div className="flex items-end gap-3">
            <label className="flex-1"><span className="label">정식 오픈 목표일 (선택)</span><input type="date" name="launchDate" className="input" /></label>
            <button className="btn-primary">만들기</button>
          </div>
        </form>
      )}
    </div>
  );
}

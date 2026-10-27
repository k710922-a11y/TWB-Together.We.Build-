"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Settings2 } from "lucide-react";
import type { UserLite } from "@/lib/queries";
import { createTask } from "@/app/actions/tasks";
import { deleteProject, updateProject } from "@/app/actions/projects";
import { Modal, Popover, useAction } from "@/components/ui";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Priority, type Status } from "@/lib/format";

type Filters = { assignee: string; status: string; priority: string };

export function ProjectHeader({ project, users, filters, editable, isAdmin }: {
  project: { id: string; title: string; description: string | null; launchDate: string | null };
  users: UserLite[]; filters: Filters; editable: boolean; isAdmin: boolean;
}) {
  const [newOpen, setNewOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const active = Object.values(filters).filter(Boolean).length;

  const setFilter = (k: keyof Filters, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(k, v); else q.delete(k);
    router.replace(`${path}?${q.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-[24px] font-bold tracking-tight">{project.title}</h1>
        {project.description && <p className="mt-0.5 text-[13px] text-sub">{project.description}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Popover align="right" className="w-[260px] p-3" trigger={(_, t) => (
          <button onClick={t} className="btn-ghost"><Filter size={14} />필터{active > 0 && <span className="rounded-full bg-brand px-1.5 text-[11px] text-white">{active}</span>}</button>
        )}>
          {() => (
            <div className="space-y-3">
              <FilterSelect label="담당자" value={filters.assignee} onChange={(v) => setFilter("assignee", v)}
                options={[["none", "미배정"], ...users.map((u) => [u.id, u.name] as [string, string])]} />
              <FilterSelect label="상태" value={filters.status} onChange={(v) => setFilter("status", v)}
                options={STATUSES.map((s) => [s, STATUS_LABEL[s]] as [string, string])} />
              <FilterSelect label="우선순위" value={filters.priority} onChange={(v) => setFilter("priority", v)}
                options={PRIORITIES.map((p) => [p, PRIORITY_LABEL[p]] as [string, string])} />
              {active > 0 && (
                <button className="text-[12px] text-brand" onClick={() => {
                  const q = new URLSearchParams(sp.toString()); ["assignee", "status", "priority"].forEach((k) => q.delete(k));
                  router.replace(`${path}?${q.toString()}`, { scroll: false });
                }}>필터 모두 해제</button>
              )}
            </div>
          )}
        </Popover>
        {editable && <button className="btn-ghost px-2.5" title="프로젝트 설정" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /></button>}
        {editable && <button className="btn-primary" onClick={() => setNewOpen(true)}>+ 새 태스크</button>}
      </div>
      <NewTaskModal open={newOpen} onClose={() => setNewOpen(false)} projectId={project.id} users={users} />
      <ProjectSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} project={project} isAdmin={isAdmin} />
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">전체</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export function NewTaskModal({ open, onClose, projectId, users, parentId, defaultStatus }: {
  open: boolean; onClose: () => void; projectId: string; users: UserLite[]; parentId?: string; defaultStatus?: Status;
}) {
  const { exec, pending } = useAction();
  const [f, setF] = useState({ title: "", status: defaultStatus ?? "todo" as Status, priority: "medium" as Priority, assigneeId: "", startDate: "", dueDate: "" });
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Modal open={open} onClose={onClose} title={parentId ? "서브태스크 추가" : "새 태스크"}>
      <form onSubmit={(e) => {
        e.preventDefault();
        exec(() => createTask({ projectId, parentId, title: f.title, status: f.status, priority: f.priority,
          assigneeId: f.assigneeId || null, startDate: f.startDate || null, dueDate: f.dueDate || null }),
        { ok: "태스크를 만들었습니다.", onOk: () => { setF({ ...f, title: "" }); onClose(); } });
      }} className="space-y-3">
        <div><label className="label">태스크 이름</label><input autoFocus required className="input" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="예: 칸반 드래그 앤 드롭 상태 반영" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">상태</label>
            <select className="input" value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></div>
          <div><label className="label">우선순위</label>
            <select className="input" value={f.priority} onChange={(e) => set("priority", e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></div>
          <div><label className="label">담당자</label>
            <select className="input" value={f.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
              <option value="">미배정</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
          <div />
          <div><label className="label">시작일</label><input type="date" className="input" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><label className="label">마감일</label><input type="date" className="input" value={f.dueDate} onChange={(e) => set("dueDate", e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
          <button className="btn-primary" disabled={pending}>만들기</button>
        </div>
      </form>
    </Modal>
  );
}

function ProjectSettings({ open, onClose, project, isAdmin }: {
  open: boolean; onClose: () => void; isAdmin: boolean;
  project: { id: string; title: string; description: string | null; launchDate: string | null };
}) {
  const { exec, pending } = useAction();
  const router = useRouter();
  const [f, setF] = useState({ title: project.title, description: project.description ?? "", launchDate: project.launchDate ?? "" });
  return (
    <Modal open={open} onClose={onClose} title="프로젝트 설정">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); exec(() => updateProject(project.id, f), { ok: "저장했습니다.", onOk: onClose }); }}>
        <div><label className="label">이름</label><input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div><label className="label">설명</label><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><label className="label">정식 오픈 목표일</label><input type="date" className="input" value={f.launchDate} onChange={(e) => setF({ ...f, launchDate: e.target.value })} /></div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => confirm("프로젝트를 보관할까요? 목록에서 숨겨집니다.") &&
              exec(() => updateProject(project.id, { archived: true }), { onOk: () => router.push("/projects") })}>보관</button>
            {isAdmin && <button type="button" className="btn-danger btn-sm" onClick={() => confirm("프로젝트와 모든 태스크를 삭제합니다. 되돌릴 수 없습니다. 계속할까요?") &&
              exec(() => deleteProject(project.id), { onOk: () => router.push("/projects") })}>삭제</button>}
          </div>
          <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={onClose}>취소</button><button className="btn-primary" disabled={pending}>저장</button></div>
        </div>
      </form>
    </Modal>
  );
}

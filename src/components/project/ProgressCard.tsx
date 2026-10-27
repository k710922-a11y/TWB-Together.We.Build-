"use client";

import { useState } from "react";
import clsx from "clsx";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Progress } from "@/lib/queries";
import { saveMilestones, type MilestoneInput } from "@/app/actions/projects";
import { Modal, useAction } from "@/components/ui";
import { fmtShort, todayStr } from "@/lib/format";

type MS = { id: string; title: string; date: string; done: boolean };

export function ProgressCard({ projectId, title, launchDate, progress, milestones, editable }: {
  projectId: string; title: string; launchDate: string | null; progress: Progress; milestones: MS[]; editable: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const today = todayStr();
  // 진행 중 = 완료되지 않은 첫 마일스톤
  const currentIdx = milestones.findIndex((m) => !m.done);
  const launch = launchDate ? launchDate.replaceAll("-", ".") : null;

  return (
    <section className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold">전체 프로젝트 진척도</h2>
          <p className="mt-1 text-[12.5px] text-sub">{title}{launch && ` · 정식 오픈 목표 ${launch}`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill bg-st-done-bg text-st-done">완료 {progress.done} / {progress.total}</span>
          <span className="pill bg-st-prog-bg text-st-prog">진행 중 {progress.inProgress}</span>
          <span className={clsx("pill", progress.delayed ? "bg-[#fde3e7] text-pri-high" : "bg-brand-50 text-brand")}>지연 {progress.delayed}</span>
          {editable && <button onClick={() => setEdit(true)} className="rounded-md p-1.5 text-faint hover:bg-canvas hover:text-ink" title="마일스톤 편집"><Pencil size={14} /></button>}
        </div>
      </div>

      <div className="relative mt-5 h-9 overflow-hidden rounded-full bg-[#eef0f8]">
        <div className="flex h-full items-center justify-end rounded-full pr-3 text-[14px] font-bold text-white transition-all"
          style={{ width: `${Math.max(progress.percent, progress.percent ? 8 : 0)}%`, background: "linear-gradient(90deg,#6c5cf5,#4f8df7)" }}>
          {progress.percent > 0 && `${progress.percent}%`}
        </div>
        {progress.percent === 0 && <span className="absolute inset-0 flex items-center pl-4 text-[13px] text-sub">0%</span>}
      </div>

      {milestones.length > 0 ? (
        <ol className="mt-5 grid gap-y-4" style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0,1fr))` }}>
          {milestones.map((m, i) => {
            const isLast = i === milestones.length - 1;
            const state = m.done ? "done" : i === currentIdx ? "current" : "planned";
            const label = m.done ? "완료" : i === currentIdx ? (m.date < today ? "지연" : "진행 중") : "예정";
            return (
              <li key={m.id} className={clsx("flex flex-col items-center text-center", isLast && milestones.length > 1 && "items-end text-right", i === 0 && milestones.length > 1 && "items-start text-left")}>
                <span className={clsx("mb-2 flex h-5 w-5 items-center justify-center", isLast ? "rotate-45 rounded-[3px] border-2" : "rounded-full border-2",
                  state === "done" ? "border-st-done bg-st-done" : state === "current" ? "border-brand bg-white" : "border-[#c5c9d6] bg-white")}>
                  {state === "done" && <span className={clsx("h-2 w-2 rounded-full bg-white", isLast && "-rotate-45")} />}
                </span>
                <span className="text-[13px] font-bold">{m.title}</span>
                <span className={clsx("mt-0.5 text-[12px]", state === "current" ? (label === "지연" ? "text-pri-high" : "text-brand") : "text-sub")}>{fmtShort(m.date)} · {label}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        editable && <button onClick={() => setEdit(true)} className="mt-4 text-[13px] text-brand">+ 마일스톤(기획 확정 → 개발 → 베타 → 오픈)을 추가해 진척 단계를 표시하세요</button>
      )}
      {edit && <MilestoneEditor projectId={projectId} initial={milestones} onClose={() => setEdit(false)} />}
    </section>
  );
}

function MilestoneEditor({ projectId, initial, onClose }: { projectId: string; initial: MS[]; onClose: () => void }) {
  const { exec, pending } = useAction();
  const [items, setItems] = useState<MilestoneInput[]>(initial.length ? initial : [
    { title: "기획 확정", date: "", done: false }, { title: "MVP 기능 개발", date: "", done: false },
    { title: "베타 배포", date: "", done: false }, { title: "정식 오픈", date: "", done: false },
  ]);
  const upd = (i: number, p: Partial<MilestoneInput>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...p } : x)));
  return (
    <Modal open onClose={onClose} title="마일스톤 편집" width={560}>
      <p className="mb-3 text-[12.5px] text-sub">날짜순으로 정렬되며, 마지막 항목이 최종 목표(◆)로 표시됩니다.</p>
      <div className="space-y-2">
        {items.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input className="input flex-1" value={m.title} onChange={(e) => upd(i, { title: e.target.value })} placeholder="단계 이름" />
            <input type="date" className="input w-[150px]" value={m.date} onChange={(e) => upd(i, { date: e.target.value })} />
            <label className="flex shrink-0 items-center gap-1 text-[12px]"><input type="checkbox" checked={m.done} onChange={(e) => upd(i, { done: e.target.checked })} />완료</label>
            <button onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} className="p-1 text-faint hover:text-pri-high"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button className="mt-3 flex items-center gap-1 text-[13px] text-brand" onClick={() => setItems((xs) => [...xs, { title: "", date: "", done: false }])}><Plus size={14} />단계 추가</button>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onClose}>취소</button>
        <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveMilestones(projectId, items), { ok: "저장했습니다.", onOk: onClose })}>저장</button>
      </div>
    </Modal>
  );
}

"use client";

import { Fragment, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { groupTasksBySubtitle } from "@/lib/task-groups";
import clsx from "clsx";
import { ChevronRight, Sparkles } from "lucide-react";
import type { TaskRow, UserLite } from "@/lib/queries";
import { createTask } from "@/app/actions/tasks";
import { Empty, useAction } from "@/components/ui";
import { AssigneeCell, DateCell, PriorityCell, StatusCell, useOpenTask, useTaskUpdate } from "./cells";

const GRID = "grid grid-cols-[minmax(260px,1fr)_120px_140px_120px_90px] items-center gap-3";

export function TaskTable({ projectId, tasks, users, editable }: { projectId: string; tasks: TaskRow[]; users: UserLite[]; editable: boolean }) {
  const tops = tasks.filter((t) => !t.parentId);
  const [open, setOpen] = useState<Record<string, boolean>>(() => (tops[0] ? { [tops[0].id]: true } : {}));
  const [adding, setAdding] = useState("");
  const { exec } = useAction();

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("tableView") === "subtitle" ? "subtitle" : "all";
  const groups = groupTasksBySubtitle(tops);
  const requestedSubtitle = searchParams.get("subtitle") ?? "";
  const selectedSubtitle = groups.some((g) => g.subtitle === requestedSubtitle) ? requestedSubtitle : "";
  const visibleGroups = selectedSubtitle ? groups.filter((g) => g.subtitle === selectedSubtitle) : groups;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const setOption = (key: string, value: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (value) q.set(key, value); else q.delete(key);
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  const renderTasks = (items: TaskRow[]) => items.map((t) => {
    const subs = tasks.filter((s) => s.parentId === t.id);
    const isOpen = open[t.id] ?? false;
    return (
      <Fragment key={t.id}>
        <div className={clsx(GRID, "border-b border-line px-4 py-4")}>
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setOpen((o) => ({ ...o, [t.id]: !isOpen }))} className="rounded p-0.5 text-faint hover:bg-canvas" aria-label="서브태스크 펼치기">
              <ChevronRight size={14} className={clsx("transition-transform", isOpen && "rotate-90")} />
            </button>
            <TitleCell t={t} editable={editable} bold />
            {subs.length > 0 ? (
              <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11.5px] font-medium text-brand">
                서브태스크 {subs.filter((s) => s.status === "done").length}/{subs.length}
              </span>
            ) : (
              <span className="shrink-0 text-[11.5px] text-faint">서브태스크 0</span>
            )}
            {t.source === "meeting" && <span title="미팅에서 자동 생성" className="shrink-0 text-brand"><Sparkles size={13} /></span>}
          </div>
          <StatusCell t={t} editable={editable} />
          <AssigneeCell t={t} users={users} editable={editable} />
          <DateCell t={t} editable={editable} />
          <PriorityCell t={t} editable={editable} />
        </div>
        {isOpen && subs.map((s, i) => (
          <div key={s.id} className={clsx(GRID, "mx-0 my-1 rounded-lg bg-[#fafbfd] px-4 py-3")}>
            <div className="flex min-w-0 items-center gap-2.5 pl-7">
              <SubCheck t={s} editable={editable} />
              <TitleCell t={s} editable={editable} />
              {editable && i === subs.length - 1 && (
                <button onClick={() => setAdding(t.id)} className="shrink-0 text-[12.5px] text-sub hover:text-brand">+ 서브태스크 추가</button>
              )}
            </div>
            <StatusCell t={s} editable={editable} plain />
            <AssigneeCell t={s} users={users} editable={editable} plain />
            <DateCell t={s} editable={editable} />
            <span />
          </div>
        ))}
        {isOpen && editable && (subs.length === 0 || adding === t.id) && (
          <InlineAdd placeholder="서브태스크 이름을 입력하고 Enter" indent autoFocus={adding === t.id}
            onAdd={(title) => exec(() => createTask({ projectId, parentId: t.id, title }), { onOk: () => setAdding("") })}
            onCancel={() => setAdding("")} />
        )}
      </Fragment>
    );
  });

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] font-medium text-sub">
          보기
          <select aria-label="태스크 보기" className="input w-auto min-w-[150px]" value={view} onChange={(e) => setOption("tableView", e.target.value)}>
            <option value="all">전체 보기</option>
            <option value="subtitle">[소제목]별 보기</option>
          </select>
        </label>
        {view === "subtitle" && (
          <label className="flex items-center gap-2 text-[13px] font-medium text-sub">
            소제목
            <select aria-label="소제목 선택" className="input w-auto min-w-[170px]" value={selectedSubtitle} onChange={(e) => setOption("subtitle", e.target.value)}>
              <option value="">모든 소제목</option>
              {groups.map((g) => <option key={g.subtitle} value={g.subtitle}>{g.subtitle === "미분류" ? "미분류" : `[${g.subtitle}]`} ({g.tasks.length})</option>)}
            </select>
          </label>
        )}
        <span className="text-[12.5px] text-faint">{view === "subtitle" ? visibleGroups.reduce((sum, g) => sum + g.tasks.length, 0) : tops.length}개 태스크</span>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className={clsx(GRID, "rounded-lg bg-canvas px-4 py-3 text-[12.5px] font-medium text-sub")}>
            <span>태스크</span><span>상태</span><span>담당자</span><span>마감일</span><span>우선순위</span>
          </div>
          {tops.length === 0 && <div className="mt-3"><Empty>아직 태스크가 없습니다. 아래에서 바로 추가해 보세요.</Empty></div>}
          {view === "all" ? renderTasks(tops) : visibleGroups.map((group) => {
            const isCollapsed = collapsed[group.subtitle] === true;
            return (
              <section key={group.subtitle} aria-label={`[${group.subtitle}] 태스크 그룹`} className="mt-3">
                <h3>
                  <button type="button" aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((prev) => ({ ...prev, [group.subtitle]: !isCollapsed }))}
                    className="flex w-full items-center gap-2 rounded-lg bg-brand-50 px-4 py-3 text-left text-[13.5px] font-semibold text-brand">
                    <ChevronRight size={15} className={clsx("shrink-0 transition-transform", !isCollapsed && "rotate-90")} />
                    {group.subtitle === "미분류" ? "미분류" : `[${group.subtitle}]`}
                    <span className="text-[12px] font-normal">{group.tasks.length}개 태스크</span>
                  </button>
                </h3>
                {!isCollapsed && renderTasks(group.tasks)}
              </section>
            );
          })}
          {editable && <InlineAdd placeholder="+ 새 태스크 이름을 입력하고 Enter" onAdd={(title) => exec(() => createTask({ projectId, title }))} />}
        </div>
      </div>
    </section>
  );
}

function SubCheck({ t, editable }: { t: TaskRow; editable: boolean }) {
  const { update } = useTaskUpdate();
  const done = t.status === "done";
  return (
    <button disabled={!editable} onClick={() => update(t, { status: done ? "todo" : "done" })}
      className={clsx("flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[4px] border", done ? "border-brand bg-brand" : "border-[#c5c9d6] bg-white")}
      aria-label={done ? "완료 취소" : "완료로 표시"}>
      {done && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 text-white"><path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2" /></svg>}
    </button>
  );
}

function TitleCell({ t, editable, bold }: { t: TaskRow; editable: boolean; bold?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(t.title);
  const { update } = useTaskUpdate();
  const openTask = useOpenTask();
  if (editing) {
    return (
      <input autoFocus className="cell-input text-[14px]" value={v} onChange={(e) => setV(e.target.value)}
        onBlur={() => { setEditing(false); if (v.trim() && v !== t.title) update(t, { title: v }); else setV(t.title); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setV(t.title); setEditing(false); } }} />
    );
  }
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5">
      <button onClick={() => openTask(t.id)} onDoubleClick={() => editable && setEditing(true)} title="클릭: 상세 · 더블클릭: 이름 수정"
        className={clsx("whitespace-normal break-words text-left text-[14px] leading-5 hover:text-brand [overflow-wrap:anywhere]", bold ? "font-semibold" : "", t.status === "done" && !bold && "text-sub")}>
        {t.title}
      </button>
    </span>
  );
}

function InlineAdd({ placeholder, onAdd, onCancel, indent, autoFocus }: {
  placeholder: string; onAdd: (title: string) => void; onCancel?: () => void; indent?: boolean; autoFocus?: boolean;
}) {
  const [v, setV] = useState("");
  return (
    <div className={clsx("px-4 py-2.5", indent && "pl-[60px]")}>
      <input autoFocus={autoFocus} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder}
        className="w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-[13.5px] outline-none placeholder:text-faint hover:border-line focus:border-brand focus:bg-white"
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) { onAdd(v.trim()); setV(""); }
          if (e.key === "Escape") { setV(""); onCancel?.(); }
        }} />
    </div>
  );
}

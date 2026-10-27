"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Calendar, ChevronRight, ListChecks, Plus, Sparkles } from "lucide-react";
import type { TaskRow, UserLite } from "@/lib/queries";
import { updateTask } from "@/app/actions/tasks";
import { Avatar, Empty, PriorityText, useAction } from "@/components/ui";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, fmtShort, todayStr, type Status } from "@/lib/format";
import { useOpenTask } from "./cells";
import { NewTaskModal } from "./ProjectHeader";
import { SubtitleBar, subtitleLabel, useSubtitleView } from "./SubtitleBar";

/** 소제목 레인의 드롭 영역 id = "소제목␀상태" */
const LANE_SEP = "\u0000";

export function Kanban({ projectId, tasks, allTasks, users, editable }: {
  projectId: string; tasks: TaskRow[]; allTasks: TaskRow[]; users: UserLite[]; editable: boolean;
}) {
  const [items, setItems] = useState(tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Status | null>(null);
  const { exec } = useAction();
  useEffect(() => setItems(tasks), [tasks]);
  const sv = useSubtitleView(items);
  const { view, visibleGroups } = sv;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const to = e.over ? (String(e.over.id).split(LANE_SEP).pop() as Status) : undefined;
    const t = items.find((x) => x.id === e.active.id);
    if (!t || !to || t.status === to) return;
    // 낙관적 반영 → 서버 저장 (충돌 시 서버 최신 상태로 되돌림)
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, status: to } : x)));
    exec(() => updateTask(t.id, t.version, { status: to }), { onErr: () => setItems(tasks) });
  }

  const dragging = items.find((x) => x.id === dragId);
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="mb-3">
        <SubtitleBar sv={sv} count={view === "subtitle" ? visibleGroups.reduce((n, g) => n + g.tasks.length, 0) : items.length} />
      </div>
      {view === "all" ? (
        <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
          {STATUSES.map((s) => {
            const col = items.filter((t) => t.status === s);
            return (
              <Column key={s} id={s} status={s} count={col.length} onAdd={editable ? () => setAdding(s) : undefined}>
                {col.map((t) => <Card key={t.id} t={t} subs={allTasks.filter((x) => x.parentId === t.id)} users={users} editable={editable} />)}
              </Column>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4 overflow-x-auto pb-2">
          {visibleGroups.length === 0 && <Empty>표시할 태스크가 없습니다.</Empty>}
          {visibleGroups.map((g) => {
            const isCollapsed = collapsed[g.subtitle] === true;
            const done = g.tasks.filter((t) => t.status === "done").length;
            return (
              <section key={g.subtitle} aria-label={`${subtitleLabel(g.subtitle)} 레인`} className="min-w-[960px] rounded-xl border border-line">
                <h3>
                  <button type="button" aria-expanded={!isCollapsed}
                    onClick={() => setCollapsed((c) => ({ ...c, [g.subtitle]: !isCollapsed }))}
                    className={clsx("flex w-full items-center gap-2 bg-brand-50 px-4 py-2.5 text-left text-[13.5px] font-semibold text-brand", isCollapsed ? "rounded-xl" : "rounded-t-xl")}>
                    <ChevronRight size={15} className={clsx("shrink-0 transition-transform", !isCollapsed && "rotate-90")} />
                    {subtitleLabel(g.subtitle)}
                    <span className="text-[12px] font-normal">{g.tasks.length}개 · 완료 {done}</span>
                    {isCollapsed && (
                      <span className="ml-auto flex gap-1.5">
                        {STATUSES.map((s) => {
                          const n = g.tasks.filter((t) => t.status === s).length;
                          return n ? <span key={s} className={clsx("pill h-5 px-2 text-[11px]", STATUS_STYLE[s].fg, STATUS_STYLE[s].bg)}>{STATUS_LABEL[s]} {n}</span> : null;
                        })}
                      </span>
                    )}
                  </button>
                </h3>
                {!isCollapsed && (
                  <div className="grid grid-cols-4 gap-3 p-3">
                    {STATUSES.map((s) => {
                      const col = g.tasks.filter((t) => t.status === s);
                      return (
                        <Column key={s} id={`${g.subtitle}${LANE_SEP}${s}`} status={s} count={col.length} compact>
                          {col.map((t) => <Card key={t.id} t={t} subs={allTasks.filter((x) => x.parentId === t.id)} users={users} editable={editable} />)}
                        </Column>
                      );
                    })}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <DragOverlay>{dragging ? <CardBody t={dragging} subs={allTasks.filter((x) => x.parentId === dragging.id)} users={users} lifted /> : null}</DragOverlay>
      {adding && <NewTaskModal open onClose={() => setAdding(null)} projectId={projectId} users={users} defaultStatus={adding} />}
    </DndContext>
  );
}

function Column({ id, status, count, children, onAdd, compact }: {
  id: string; status: Status; count: number; children: React.ReactNode; onAdd?: () => void; compact?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const st = STATUS_STYLE[status];
  return (
    <div ref={setNodeRef} className={clsx("flex min-w-[220px] flex-col rounded-xl bg-canvas p-3 transition-colors", compact ? "min-h-[120px]" : "min-h-[320px]", isOver && "bg-brand-50 ring-2 ring-brand/30")}>
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-[13.5px] font-bold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: st.bar }} />{STATUS_LABEL[status]}
          <span className="font-normal text-faint">{count}</span>
        </span>
        {onAdd && <button onClick={onAdd} className="rounded p-1 text-faint hover:bg-white hover:text-ink" aria-label="태스크 추가"><Plus size={15} /></button>}
      </div>
      <div className="flex flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Card({ t, subs, users, editable }: { t: TaskRow; subs: TaskRow[]; users: UserLite[]; editable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id, disabled: !editable });
  const openTask = useOpenTask();
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} onClick={() => openTask(t.id)}
      className={clsx("cursor-pointer", editable && "touch-none", isDragging && "opacity-30")}>
      <CardBody t={t} subs={subs} users={users} />
    </div>
  );
}

function CardBody({ t, subs, users, lifted }: { t: TaskRow; subs: TaskRow[]; users: UserLite[]; lifted?: boolean }) {
  const u = users.find((x) => x.id === t.assigneeId);
  const overdue = t.dueDate && t.status !== "done" && t.dueDate < todayStr();
  return (
    <div className={clsx("rounded-lg border border-line bg-white p-3.5 hover:border-brand/40", lifted && "rotate-1 shadow-xl")}>
      <div className="flex items-start gap-1.5">
        <p className="flex-1 text-[13.5px] font-semibold leading-snug">{t.title}</p>
        {t.source === "meeting" && <Sparkles size={13} className="mt-0.5 shrink-0 text-brand" />}
      </div>
      <div className="mt-3 flex items-center gap-3 text-[12px] text-sub">
        <Avatar name={u?.name} color={u?.color} size={22} />
        {t.dueDate && <span className={clsx("flex items-center gap-1", overdue && "font-semibold text-pri-high")}><Calendar size={12} />{fmtShort(t.dueDate)}</span>}
        {subs.length > 0 && <span className="flex items-center gap-1"><ListChecks size={12} />{subs.filter((s) => s.status === "done").length}/{subs.length}</span>}
        <span className="ml-auto"><PriorityText priority={t.priority} /></span>
      </div>
    </div>
  );
}

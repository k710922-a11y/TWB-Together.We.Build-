"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { Calendar, ListChecks, Plus, Sparkles } from "lucide-react";
import type { TaskRow, UserLite } from "@/lib/queries";
import { updateTask } from "@/app/actions/tasks";
import { Avatar, PriorityText, useAction } from "@/components/ui";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, fmtShort, todayStr, type Status } from "@/lib/format";
import { useOpenTask } from "./cells";
import { NewTaskModal } from "./ProjectHeader";

export function Kanban({ projectId, tasks, allTasks, users, editable }: {
  projectId: string; tasks: TaskRow[]; allTasks: TaskRow[]; users: UserLite[]; editable: boolean;
}) {
  const [items, setItems] = useState(tasks);
  const [dragId, setDragId] = useState<string | null>(null);
  const [adding, setAdding] = useState<Status | null>(null);
  const { exec } = useAction();
  useEffect(() => setItems(tasks), [tasks]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const to = e.over?.id as Status | undefined;
    const t = items.find((x) => x.id === e.active.id);
    if (!t || !to || t.status === to) return;
    // 낙관적 반영 → 서버 저장 (충돌 시 서버 최신 상태로 되돌림)
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, status: to } : x)));
    exec(() => updateTask(t.id, t.version, { status: to }), { onErr: () => setItems(tasks) });
  }

  const dragging = items.find((x) => x.id === dragId);
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
      <div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-2 xl:grid-cols-4">
        {STATUSES.map((s) => {
          const col = items.filter((t) => t.status === s);
          return (
            <Column key={s} status={s} count={col.length} onAdd={editable ? () => setAdding(s) : undefined}>
              {col.map((t) => <Card key={t.id} t={t} subs={allTasks.filter((x) => x.parentId === t.id)} users={users} editable={editable} />)}
            </Column>
          );
        })}
      </div>
      <DragOverlay>{dragging ? <CardBody t={dragging} subs={allTasks.filter((x) => x.parentId === dragging.id)} users={users} lifted /> : null}</DragOverlay>
      {adding && <NewTaskModal open onClose={() => setAdding(null)} projectId={projectId} users={users} defaultStatus={adding} />}
    </DndContext>
  );
}

function Column({ status, count, children, onAdd }: { status: Status; count: number; children: React.ReactNode; onAdd?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const st = STATUS_STYLE[status];
  return (
    <div ref={setNodeRef} className={clsx("flex min-h-[320px] min-w-[240px] flex-col rounded-xl bg-canvas p-3 transition-colors", isOver && "bg-brand-50 ring-2 ring-brand/30")}>
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

"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";
import type { TaskRow, UserLite } from "@/lib/queries";
import { updateTask, type TaskPatch } from "@/app/actions/tasks";
import { Avatar, MenuItem, Popover, PriorityText, StatusPill, useAction } from "@/components/ui";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_STYLE, STATUS_LABEL, fmtKoDate, todayStr, type Priority, type Status } from "@/lib/format";

export function useTaskUpdate() {
  const { exec, pending } = useAction();
  return {
    pending,
    update: (t: TaskRow, patch: TaskPatch, ok?: string) => exec(() => updateTask(t.id, t.version, patch), { ok }),
  };
}

/** 태스크 상세 패널 열기 (URL ?task=) */
export function useOpenTask() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (id: string | null) => {
    const q = new URLSearchParams(sp.toString());
    if (id) q.set("task", id); else q.delete("task");
    router.push(`${path}?${q.toString()}`, { scroll: false });
  };
}

export function StatusCell({ t, editable, plain }: { t: TaskRow; editable: boolean; plain?: boolean }) {
  const { update } = useTaskUpdate();
  const view = plain
    ? <span className={clsx("text-[13px] font-medium", STATUS_STYLE[t.status].fg)}>{STATUS_LABEL[t.status]}</span>
    : <StatusPill status={t.status} />;
  if (!editable) return view;
  return (
    <Popover trigger={(_, toggle) => <button onClick={toggle} className="cursor-pointer">{view}</button>}>
      {(close) => STATUSES.map((s) => (
        <MenuItem key={s} active={t.status === s} onClick={() => { close(); if (s !== t.status) update(t, { status: s as Status }); }}>
          <StatusPill status={s} />
        </MenuItem>
      ))}
    </Popover>
  );
}

export function AssigneeCell({ t, users, editable, plain }: { t: TaskRow; users: UserLite[]; editable: boolean; plain?: boolean }) {
  const { update } = useTaskUpdate();
  const u = users.find((x) => x.id === t.assigneeId);
  const view = (
    <span className="flex items-center gap-2 text-[13.5px]">
      {!plain && <Avatar name={u?.name} color={u?.color} size={24} />}
      <span className={u ? "" : "text-faint"}>{u?.name ?? "미배정"}</span>
    </span>
  );
  if (!editable) return view;
  return (
    <Popover trigger={(_, toggle) => <button onClick={toggle}>{view}</button>}>
      {(close) => (
        <>
          <MenuItem active={!t.assigneeId} onClick={() => { close(); update(t, { assigneeId: null }); }}><Avatar size={20} /> 미배정</MenuItem>
          {users.map((x) => (
            <MenuItem key={x.id} active={x.id === t.assigneeId} onClick={() => { close(); update(t, { assigneeId: x.id }); }}>
              <Avatar name={x.name} color={x.color} size={20} /> {x.name}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

export function DateCell({ t, field = "dueDate", editable }: { t: TaskRow; field?: "dueDate" | "startDate"; editable: boolean }) {
  const { update } = useTaskUpdate();
  const v = t[field];
  const overdue = field === "dueDate" && v && t.status !== "done" && v < todayStr();
  const label = <span className={clsx("text-[13.5px]", overdue && "font-semibold text-pri-high", !v && "text-faint")}>{v ? fmtKoDate(v) : "—"}</span>;
  if (!editable) return label;
  return (
    <label className="relative inline-block cursor-pointer">
      {label}
      <input type="date" value={v ?? ""} onChange={(e) => update(t, { [field]: e.target.value || null })}
        className="absolute inset-0 cursor-pointer opacity-0" aria-label={field === "dueDate" ? "마감일" : "시작일"}
        onClick={(e) => (e.currentTarget as HTMLInputElement).showPicker?.()} />
    </label>
  );
}

export function PriorityCell({ t, editable }: { t: TaskRow; editable: boolean }) {
  const { update } = useTaskUpdate();
  const view = <span className="text-[13.5px]"><PriorityText priority={t.priority} /></span>;
  if (!editable) return view;
  return (
    <Popover align="right" trigger={(_, toggle) => <button onClick={toggle}>{view}</button>}>
      {(close) => PRIORITIES.map((p) => (
        <MenuItem key={p} active={p === t.priority} onClick={() => { close(); update(t, { priority: p as Priority }); }}>
          <PriorityText priority={p} /> <span className="sr-only">{PRIORITY_LABEL[p]}</span>
        </MenuItem>
      ))}
    </Popover>
  );
}

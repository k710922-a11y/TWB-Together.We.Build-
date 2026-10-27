"use client";

import clsx from "clsx";
import type { TaskRow, UserLite } from "@/lib/queries";
import { Avatar, StatusPill } from "@/components/ui";
import { STATUSES, STATUS_LABEL, STATUS_STYLE, fmtKoDate, todayStr, diffDays } from "@/lib/format";
import { useOpenTask } from "./cells";

export function ProjectDashboard({ tasks, users }: { tasks: TaskRow[]; users: UserLite[] }) {
  const openTask = useOpenTask();
  const today = todayStr();
  const tops = tasks.filter((t) => !t.parentId);
  const open = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const soon = open.filter((t) => t.dueDate && t.dueDate >= today && diffDays(today, t.dueDate) <= 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const counts = STATUSES.map((s) => ({ s, n: tops.filter((t) => t.status === s).length }));
  const load = [...users.map((u) => ({ u, n: open.filter((t) => t.assigneeId === u.id).length })),
    { u: null, n: open.filter((t) => !t.assigneeId).length }].filter((x) => x.n > 0 || x.u);
  const maxLoad = Math.max(1, ...load.map((l) => l.n));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card p-5">
        <h3 className="text-[15px] font-bold">상태별 태스크</h3>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-canvas">
          {counts.map(({ s, n }) => n > 0 && <div key={s} style={{ width: `${(n / Math.max(1, tops.length)) * 100}%`, background: STATUS_STYLE[s].bar }} title={`${STATUS_LABEL[s]} ${n}`} />)}
        </div>
        <ul className="mt-4 grid grid-cols-4 gap-2 text-center">
          {counts.map(({ s, n }) => (
            <li key={s} className="rounded-lg bg-canvas py-3">
              <div className="text-[22px] font-bold">{n}</div>
              <div className={clsx("text-[12px] font-medium", STATUS_STYLE[s].fg)}>{STATUS_LABEL[s]}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5">
        <h3 className="text-[15px] font-bold">담당자별 남은 일</h3>
        <ul className="mt-4 space-y-2.5">
          {load.map(({ u, n }) => (
            <li key={u?.id ?? "none"} className="flex items-center gap-3">
              <Avatar name={u?.name} color={u?.color} size={24} />
              <span className="w-16 truncate text-[13px]">{u?.name ?? "미배정"}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-canvas">
                <div className="h-full rounded-full bg-brand" style={{ width: `${(n / maxLoad) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-[13px] font-semibold">{n}</span>
            </li>
          ))}
        </ul>
      </section>

      <TaskList title={`지연 ${overdue.length}건`} tone="text-pri-high" tasks={overdue} users={users} onOpen={openTask} empty="지연된 태스크가 없습니다." />
      <TaskList title={`7일 이내 마감 ${soon.length}건`} tone="text-ink" tasks={soon} users={users} onOpen={openTask} empty="일주일 안에 마감되는 태스크가 없습니다." />
    </div>
  );
}

function TaskList({ title, tone, tasks, users, onOpen, empty }: {
  title: string; tone: string; tasks: TaskRow[]; users: UserLite[]; onOpen: (id: string) => void; empty: string;
}) {
  return (
    <section className="card p-5">
      <h3 className={clsx("text-[15px] font-bold", tone)}>{title}</h3>
      {tasks.length === 0 ? <p className="mt-3 text-[13px] text-sub">{empty}</p> : (
        <ul className="mt-3 divide-y divide-line">
          {tasks.map((t) => {
            const u = users.find((x) => x.id === t.assigneeId);
            return (
              <li key={t.id}>
                <button onClick={() => onOpen(t.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-brand">
                  <span className="flex-1 truncate text-[13.5px]">{t.title}</span>
                  <StatusPill status={t.status} />
                  <Avatar name={u?.name} color={u?.color} size={22} />
                  <span className="w-[68px] text-right text-[12.5px] text-sub">{fmtKoDate(t.dueDate)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

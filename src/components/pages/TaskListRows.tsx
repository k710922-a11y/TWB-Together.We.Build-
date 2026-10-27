import Link from "next/link";
import clsx from "clsx";
import { Avatar, StatusPill } from "@/components/ui";
import type { TaskRow, UserLite } from "@/lib/queries";
import { fmtKoDate, todayStr } from "@/lib/format";

/** 홈·내 할 일 공용 목록 (서버 컴포넌트) */
export function TaskListRows({ tasks, users, showAssignee }: { tasks: (TaskRow & { projectTitle: string })[]; users?: UserLite[]; showAssignee?: boolean }) {
  const today = todayStr();
  return (
    <ul className="divide-y divide-line">
      {tasks.map((t) => {
        const u = users?.find((x) => x.id === t.assigneeId);
        const overdue = t.dueDate && t.dueDate < today;
        return (
          <li key={t.id}>
            <Link href={`/projects/${t.projectId}?task=${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-canvas">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13.5px] font-medium">{t.title}</div>
                <div className="truncate text-[11.5px] text-faint">{t.projectTitle}</div>
              </div>
              <StatusPill status={t.status} />
              {showAssignee && <Avatar name={u?.name} color={u?.color} size={22} />}
              <span className={clsx("w-[64px] text-right text-[12.5px]", overdue ? "font-semibold text-pri-high" : "text-sub")}>{fmtKoDate(t.dueDate)}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

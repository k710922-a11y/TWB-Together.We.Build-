import { requireUser } from "@/lib/auth";
import { myOpenTasks } from "@/lib/queries";
import { TaskListRows } from "@/components/pages/TaskListRows";
import { Empty } from "@/components/ui";
import { todayStr } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "내 할 일" };

export default async function MyTasks() {
  const me = await requireUser();
  const tasks = await myOpenTasks(me.id);
  const today = todayStr();
  const groups = [
    { title: "지연", items: tasks.filter((t) => t.dueDate && t.dueDate < today) },
    { title: "오늘·이번 주", items: tasks.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= addDays(today, 7)) },
    { title: "나중에", items: tasks.filter((t) => t.dueDate && t.dueDate > addDays(today, 7)) },
    { title: "기한 없음", items: tasks.filter((t) => !t.dueDate) },
  ].filter((g) => g.items.length);
  return (
    <div className="space-y-5 px-5 py-7 lg:px-8">
      <h1 className="text-[24px] font-bold tracking-tight">내 할 일 <span className="text-[15px] font-normal text-sub">{tasks.length}건</span></h1>
      {groups.length === 0 && <Empty>맡은 일이 모두 끝났습니다 🎉</Empty>}
      {groups.map((g) => (
        <section key={g.title} className="card overflow-hidden">
          <h2 className={`border-b border-line px-4 py-2.5 text-[13.5px] font-bold ${g.title === "지연" ? "text-pri-high" : ""}`}>{g.title} {g.items.length}</h2>
          <TaskListRows tasks={g.items} />
        </section>
      ))}
    </div>
  );
}

function addDays(s: string, n: number) {
  const d = new Date(s + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

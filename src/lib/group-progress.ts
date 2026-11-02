/** 묶음(대분류·소제목)별 진척도 — 상단 '전체 프로젝트 진척도'와 같은 계산 방식 (순수 함수) */
// 테스트(node --test)에서 바로 불러올 수 있게 외부 import 없이 둔다
const STATUSES = ["todo", "in_progress", "review", "done"] as const;
type Status = (typeof STATUSES)[number];
const seoulToday = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

type T = { id: string; parentId: string | null; status: Status; dueDate: string | null };
export type GroupProgress = { total: number; done: number; percent: number; counts: Record<Status, number>; overdue: number };

export function groupProgress(tops: T[], allTasks: T[], today = seoulToday()): GroupProgress {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<Status, number>;
  let score = 0;
  let overdue = 0;
  for (const t of tops) {
    counts[t.status]++;
    const subs = allTasks.filter((s) => s.parentId === t.id);
    if (t.status === "done") score += 1;
    else if (subs.length) score += subs.filter((s) => s.status === "done").length / subs.length;
    for (const x of [t, ...subs]) if (x.status !== "done" && x.dueDate && x.dueDate < today) overdue++;
  }
  return { total: tops.length, done: counts.done, percent: tops.length ? Math.round((score / tops.length) * 100) : 0, counts, overdue };
}

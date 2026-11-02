/** 제목 앞의 [KT-001] 같은 식별자는 건너뛰고 첫 소제목을 분류명으로 사용한다. */
export function taskSubtitle(title: string): string {
  const prefix = title.trimStart().match(/^(?:\[[^\]]*\]\s*)+/)?.[0] ?? "";
  const tokens = Array.from(prefix.matchAll(/\[([^\]]*)\]/g), (m) => m[1].trim().replace(/^\*\*(.*?)\*\*$/, "$1").trim());
  return tokens.find((token) => token && !/^(?:[a-z]+[-_ ]?)?\d+(?:[-_.]\d+)*$/i.test(token)) ?? "미분류";
}

export function groupTasksBySubtitle<T extends { title: string }>(tasks: T[]): { subtitle: string; tasks: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const task of tasks) {
    const subtitle = taskSubtitle(task.title);
    const list = groups.get(subtitle);
    if (list) list.push(task);
    else groups.set(subtitle, [task]);
  }
  return Array.from(groups, ([subtitle, tasks]) => ({ subtitle, tasks }));
}

export type Category = { name: string; subtitles: string[] };
export type TaskGroup<T> = { key: string; label: string; tasks: T[]; subtitles: string[] };

/**
 * 대분류별 묶기. 대분류 순서를 따르고, 어느 대분류에도 없는 소제목은 마지막 '기타'에 모은다.
 * 각 묶음 안에서는 소제목 순서대로, 같은 소제목 안에서는 원래 순서대로 둔다.
 */
export function groupTasksByCategory<T extends { title: string }>(tasks: T[], categories: Category[]): TaskGroup<T>[] {
  const bySub = groupTasksBySubtitle(tasks);
  const owner = new Map<string, string>();
  for (const c of categories) for (const s of c.subtitles) if (!owner.has(s)) owner.set(s, c.name);
  const out: TaskGroup<T>[] = categories.map((c) => ({ key: `c:${c.name}`, label: c.name, tasks: [], subtitles: [] }));
  const etc: TaskGroup<T> = { key: "c:__etc__", label: "기타 (대분류 미지정)", tasks: [], subtitles: [] };
  for (const g of bySub) {
    const name = owner.get(g.subtitle);
    const target = name ? out.find((o) => o.label === name)! : etc;
    target.tasks.push(...g.tasks);
    target.subtitles.push(g.subtitle);
  }
  return [...out, etc].filter((g) => g.tasks.length > 0);
}

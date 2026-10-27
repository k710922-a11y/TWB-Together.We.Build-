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

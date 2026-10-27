export const STATUSES = ["todo", "in_progress", "review", "done"] as const;
export type Status = (typeof STATUSES)[number];
export const PRIORITIES = ["high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUS_LABEL: Record<Status, string> = {
  todo: "진행 전", in_progress: "진행 중", review: "검토", done: "완료",
};
export const STATUS_STYLE: Record<Status, { fg: string; bg: string; bar: string }> = {
  todo: { fg: "text-st-todo", bg: "bg-st-todo-bg", bar: "#c5c9d6" },
  in_progress: { fg: "text-st-prog", bg: "bg-st-prog-bg", bar: "#4f9bf5" },
  review: { fg: "text-st-review", bg: "bg-st-review-bg", bar: "#f6a33a" },
  done: { fg: "text-st-done", bg: "bg-st-done-bg", bar: "#12c47a" },
};
export const PRIORITY_LABEL: Record<Priority, string> = { high: "높음", medium: "중간", low: "낮음" };
export const PRIORITY_STYLE: Record<Priority, string> = {
  high: "text-pri-high", medium: "text-pri-mid", low: "text-pri-low",
};
export const ROLE_LABEL = { admin: "관리자", editor: "편집자", viewer: "보기" } as const;

export const AVATAR_COLORS = ["#f5a623", "#00b26b", "#5b5bf0", "#a25ddc", "#2f80ed", "#e2445c", "#0aa5a5", "#f06292"];

/** 서울 기준 오늘 (YYYY-MM-DD) */
export function todayStr(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function dayStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(s: string, n: number): string {
  const d = parseDay(s);
  d.setUTCDate(d.getUTCDate() + n);
  return dayStr(d);
}
export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400_000);
}

/** 10월 27일 */
export function fmtKoDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = parseDay(s);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}
/** 10/27 */
export function fmtShort(s: string | null | undefined): string {
  if (!s) return "—";
  const d = parseDay(s);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
/** 10/22 14:05 (서울) */
export function fmtStamp(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const p = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return `${g("month")}/${g("day")} ${g("hour")}:${g("minute")}`;
}
export function fmtRelative(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = (Date.now() - date.getTime()) / 1000;
  if (sec < 60) return "방금 전";
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}
export function fmtBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

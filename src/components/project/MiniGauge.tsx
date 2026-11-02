import clsx from "clsx";
import { STATUSES, STATUS_LABEL, STATUS_STYLE } from "@/lib/format";
import type { GroupProgress } from "@/lib/group-progress";

/** 묶음 이름 옆 미니 진척도: 상태별 색 막대 + 진척률 + 완료 수 + 지연 */
export function MiniGauge({ p, compact }: { p: GroupProgress; compact?: boolean }) {
  const tip = [`진척도 ${p.percent}%`, ...STATUSES.map((s) => `${STATUS_LABEL[s]} ${p.counts[s]}`), p.overdue ? `지연 ${p.overdue}` : ""].filter(Boolean).join(" · ");
  const order = ["done", "review", "in_progress", "todo"] as const; // 완료가 왼쪽부터 차오르게
  return (
    <span className="inline-flex shrink-0 items-center gap-2" title={tip} aria-label={tip}>
      <span className={clsx("flex h-2 overflow-hidden rounded-full bg-[#e6e8f0]", compact ? "w-16" : "w-24")}>
        {p.total > 0 && order.map((s) => p.counts[s] > 0 && (
          <span key={s} className="h-full" style={{ width: `${(p.counts[s] / p.total) * 100}%`, background: STATUS_STYLE[s].bar }} />
        ))}
      </span>
      <span className={clsx("w-9 text-right text-[12px] font-bold tabular-nums", p.percent === 100 ? "text-st-done" : "text-ink")}>{p.percent}%</span>
      {!compact && <span className="text-[11.5px] font-normal tabular-nums text-sub">완료 {p.done}/{p.total}</span>}
      {p.overdue > 0 && <span className="rounded-full bg-[#fde3e7] px-1.5 text-[10.5px] font-semibold text-pri-high">지연 {p.overdue}</span>}
    </span>
  );
}

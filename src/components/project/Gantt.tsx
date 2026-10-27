"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import type { TaskRow } from "@/lib/queries";
import { Empty } from "@/components/ui";
import { STATUS_STYLE, addDays, diffDays, fmtShort, parseDay, todayStr } from "@/lib/format";
import { useOpenTask } from "./cells";

const ROW = 46;
const HEAD = 36;
const LABEL_W = 240;

/** 월요일로 내림 */
function weekStart(s: string) {
  const d = parseDay(s);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(s, -dow);
}

export function Gantt({ tasks, deps, milestones }: {
  tasks: TaskRow[]; deps: { taskId: string; dependsOnId: string }[]; milestones: { title: string; date: string }[];
}) {
  const [scale, setScale] = useState<"week" | "day">("week");
  const openTask = useOpenTask();
  const today = todayStr();

  // 시작일이 없으면 마감 3일 전, 마감이 없으면 시작+3일로 표시
  const bars = useMemo(() => tasks
    .filter((t) => t.startDate || t.dueDate)
    .map((t) => {
      const start = t.startDate ?? addDays(t.dueDate!, -3);
      const end = t.dueDate ?? addDays(t.startDate!, 3);
      return { t, start, end };
    }), [tasks]);
  const undated = tasks.filter((t) => !t.startDate && !t.dueDate);

  if (!bars.length) {
    return (
      <section>
        <GanttHead scale={scale} setScale={setScale} range="" />
        <Empty>시작일·마감일이 있는 태스크가 없습니다. 테이블이나 태스크 상세에서 날짜를 넣으면 간트 차트에 표시됩니다.</Empty>
      </section>
    );
  }

  const dates = [...bars.flatMap((b) => [b.start, b.end]), ...milestones.map((m) => m.date), today];
  const min = weekStart(dates.reduce((a, b) => (a < b ? a : b)));
  const maxRaw = dates.reduce((a, b) => (a > b ? a : b));
  const max = addDays(weekStart(maxRaw), 6);
  const days = diffDays(min, max) + 1;
  const px = scale === "week" ? 24 : 40; // 하루당 픽셀
  const width = days * px;
  const x = (d: string) => diffDays(min, d) * px;
  const weeks = Array.from({ length: Math.ceil(days / 7) }, (_, i) => addDays(min, i * 7));
  const rowOf = new Map(bars.map((b, i) => [b.t.id, i]));
  const progressOf = (t: TaskRow) => (t.status === "done" ? 1 : t.status === "review" ? 0.85 : t.status === "in_progress" ? 0.5 : 0);

  const depLines = deps.filter((d) => rowOf.has(d.taskId) && rowOf.has(d.dependsOnId));
  const title = (id: string) => tasks.find((t) => t.id === id)?.title ?? "";

  return (
    <section>
      <GanttHead scale={scale} setScale={setScale} range={`${fmtShort(min)} – ${fmtShort(max)} · ${scale === "week" ? "주" : "일"} 단위`} />
      <div className="card overflow-hidden">
        <div className="flex">
          {/* 왼쪽 태스크 이름 */}
          <div className="shrink-0 border-r border-line bg-white" style={{ width: LABEL_W }}>
            <div className="flex items-center border-b border-line bg-canvas px-4 text-[12px] text-sub" style={{ height: HEAD }}>태스크</div>
            {bars.map(({ t }) => (
              <button key={t.id} onClick={() => openTask(t.id)} className="flex w-full items-center border-b border-line px-4 text-left text-[13.5px] font-medium hover:bg-canvas" style={{ height: ROW }}>
                <span className="truncate">{t.title}</span>
              </button>
            ))}
          </div>
          {/* 오른쪽 타임라인 */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="relative" style={{ width, height: HEAD + bars.length * ROW }}>
              {/* 헤더 */}
              <div className="absolute inset-x-0 top-0 flex border-b border-line bg-canvas" style={{ height: HEAD }}>
                {scale === "week"
                  ? weeks.map((w) => <div key={w} className="shrink-0 border-l border-line px-2 text-[12px] leading-[36px] text-sub" style={{ width: 7 * px }}>{fmtShort(w)} 주</div>)
                  : Array.from({ length: days }, (_, i) => addDays(min, i)).map((d) => {
                    const dow = parseDay(d).getUTCDay();
                    return <div key={d} className={clsx("shrink-0 border-l border-line text-center text-[11px] leading-[36px]", dow === 0 || dow === 6 ? "text-faint" : "text-sub")} style={{ width: px }}>{parseDay(d).getUTCDate()}</div>;
                  })}
              </div>
              {/* 세로 구분선 + 행 */}
              {weeks.map((w) => <div key={w} className="absolute bottom-0 border-l border-line" style={{ left: x(w), top: HEAD }} />)}
              {bars.map((_, i) => <div key={i} className="absolute inset-x-0 border-b border-line" style={{ top: HEAD + (i + 1) * ROW - 1 }} />)}
              {/* 오늘 */}
              <div className="absolute bottom-0 w-px bg-pri-high/60" style={{ left: x(today) + px / 2, top: HEAD - 6 }}>
                <span className="absolute -top-0 left-1 whitespace-nowrap rounded bg-pri-high px-1 text-[10px] text-white">오늘</span>
              </div>
              {/* 마일스톤 */}
              {milestones.map((m) => (
                <div key={m.title + m.date} className="absolute bottom-0 border-l border-dashed border-brand/40" style={{ left: x(m.date) + px / 2, top: HEAD }} title={`${m.title} ${fmtShort(m.date)}`} />
              ))}
              {/* 막대 */}
              {bars.map(({ t, start, end }, i) => {
                const left = x(start);
                const w = Math.max(px, x(end) - left + px);
                const st = STATUS_STYLE[t.status];
                const p = progressOf(t);
                return (
                  <button key={t.id} onClick={() => openTask(t.id)} title={`${t.title} (${fmtShort(start)}~${fmtShort(end)})`}
                    className="absolute overflow-hidden rounded-md transition-opacity hover:opacity-85"
                    style={{ left, width: w, top: HEAD + i * ROW + 12, height: ROW - 24, background: t.status === "in_progress" ? "#cfe3fd" : st.bar }}>
                    {t.status === "in_progress" && <span className="absolute inset-y-0 left-0" style={{ width: `${p * 100}%`, background: st.bar }} />}
                  </button>
                );
              })}
              {/* 의존 관계 화살표 */}
              <svg className="pointer-events-none absolute inset-0" width={width} height={HEAD + bars.length * ROW}>
                <defs><marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 z" fill="#8b90a3" /></marker></defs>
                {depLines.map((d) => {
                  const a = bars[rowOf.get(d.dependsOnId)!], b = bars[rowOf.get(d.taskId)!];
                  const x1 = x(a.end) + px, y1 = HEAD + rowOf.get(d.dependsOnId)! * ROW + ROW / 2;
                  const x2 = x(b.start), y2 = HEAD + rowOf.get(d.taskId)! * ROW + ROW / 2;
                  const mid = Math.max(x1 + 8, Math.min(x2 - 8, x1 + 14));
                  const bad = b.start <= a.end; // 선행 태스크가 끝나기 전에 시작 → 빨간색
                  return <path key={d.taskId + d.dependsOnId} d={`M${x1},${y1} H${mid} V${y2} H${x2}`} fill="none" stroke={bad ? "#e2445c" : "#8b90a3"} strokeWidth="1.4" markerEnd="url(#arr)" />;
                })}
              </svg>
            </div>
          </div>
        </div>
      </div>
      {depLines.length > 0 && (
        <p className="mt-3 text-[12.5px] text-sub">
          의존 관계: {depLines.map((d) => `${title(d.dependsOnId)} → ${title(d.taskId)}`).join(" · ")} (끝나는 날짜가 다음 태스크의 시작 조건, 빨간 선은 일정 겹침)
        </p>
      )}
      {undated.length > 0 && <p className="mt-1.5 text-[12.5px] text-faint">일정 미정 {undated.length}건: {undated.map((t) => t.title).join(", ")}</p>}
    </section>
  );
}

function GanttHead({ scale, setScale, range }: { scale: "week" | "day"; setScale: (s: "week" | "day") => void; range: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[16px] font-bold">간트 차트 <span className="ml-1.5 text-[12.5px] font-normal text-sub">{range}</span></h2>
      <div className="flex gap-1.5">
        {(["week", "day"] as const).map((s) => (
          <button key={s} onClick={() => setScale(s)}
            className={clsx("h-8 rounded-lg border px-3 text-[13px]", scale === s ? "border-brand bg-white font-semibold text-brand" : "border-line text-sub")}>
            {s === "week" ? "주" : "일"}
          </button>
        ))}
      </div>
    </div>
  );
}

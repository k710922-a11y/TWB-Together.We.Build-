"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { groupTasksBySubtitle } from "@/lib/task-groups";

/**
 * 테이블·칸반·간트 공용 [소제목]별 보기 설정.
 * URL의 tableView=subtitle, subtitle=<이름>을 세 화면이 함께 써서 탭을 옮겨도 보기가 유지된다.
 */
export function useSubtitleView<T extends { title: string }>(tops: T[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view: "all" | "subtitle" = searchParams.get("tableView") === "subtitle" ? "subtitle" : "all";
  const groups = useMemo(() => groupTasksBySubtitle(tops), [tops]);
  const requested = searchParams.get("subtitle") ?? "";
  const selectedSubtitle = groups.some((g) => g.subtitle === requested) ? requested : "";
  const visibleGroups = useMemo(() => (selectedSubtitle ? groups.filter((g) => g.subtitle === selectedSubtitle) : groups), [groups, selectedSubtitle]);
  const setOption = (key: "tableView" | "subtitle", value: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (value && !(key === "tableView" && value === "all")) q.set(key, value); else q.delete(key);
    if (key === "tableView" && value !== "subtitle") q.delete("subtitle");
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return { view, groups, selectedSubtitle, visibleGroups, setOption };
}

export const subtitleLabel = (s: string) => (s === "미분류" ? "미분류" : `[${s}]`);

export function SubtitleBar({ sv, count, unit = "태스크" }: {
  sv: ReturnType<typeof useSubtitleView<{ title: string }>>; count: number; unit?: string;
}) {
  const { view, groups, selectedSubtitle, setOption } = sv;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[13px] font-medium text-sub">
        보기
        <select aria-label="태스크 보기" className="input w-auto min-w-[150px]" value={view} onChange={(e) => setOption("tableView", e.target.value)}>
          <option value="all">전체 보기</option>
          <option value="subtitle">[소제목]별 보기</option>
        </select>
      </label>
      {view === "subtitle" && (
        <label className="flex items-center gap-2 text-[13px] font-medium text-sub">
          소제목
          <select aria-label="소제목 선택" className="input w-auto min-w-[170px]" value={selectedSubtitle} onChange={(e) => setOption("subtitle", e.target.value)}>
            <option value="">모든 소제목</option>
            {groups.map((g) => <option key={g.subtitle} value={g.subtitle}>{subtitleLabel(g.subtitle)} ({g.tasks.length})</option>)}
          </select>
        </label>
      )}
      <span className="text-[12.5px] text-faint">{count}개 {unit}</span>
    </div>
  );
}

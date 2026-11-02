"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers } from "lucide-react";
import { groupTasksByCategory, groupTasksBySubtitle, type Category } from "@/lib/task-groups";
import { CategoryEditor } from "./CategoryEditor";

/** 프로젝트 화면이 내려주는 대분류 설정 */
type CategoryCtx = { projectId: string; categories: Category[]; allSubtitles: string[]; editable: boolean };
const Ctx = createContext<CategoryCtx>({ projectId: "", categories: [], allSubtitles: [], editable: false });
export function CategoryProvider({ value, children }: { value: CategoryCtx; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export type View = "all" | "category" | "subtitle";
/** 화면에 그리는 묶음. subtitle 필드는 묶음 키(소제목 이름 또는 대분류 이름)로 쓴다 */
export type ViewGroup<T> = { subtitle: string; label: string; tasks: T[]; subtitles: string[] };

export const subtitleLabel = (s: string) => (s === "미분류" ? "미분류" : `[${s}]`);

/**
 * 테이블·칸반·간트 공용 묶어 보기 설정.
 * URL의 tableView=category|subtitle, subtitle=<묶음 이름>을 세 화면이 함께 써서 탭을 옮겨도 유지된다.
 * 대분류가 정해진 프로젝트는 기본이 '대분류별 보기'다.
 */
export function useSubtitleView<T extends { title: string }>(tops: T[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { categories } = useContext(Ctx);
  const raw = searchParams.get("tableView");
  const view: View = raw === "subtitle" ? "subtitle" : raw === "category" ? "category" : raw === "all" ? "all" : categories.length ? "category" : "all";

  const groups: ViewGroup<T>[] = useMemo(() => {
    if (view === "category") return groupTasksByCategory(tops, categories).map((g) => ({ subtitle: g.label, label: g.label, tasks: g.tasks, subtitles: g.subtitles }));
    return groupTasksBySubtitle(tops).map((g) => ({ subtitle: g.subtitle, label: subtitleLabel(g.subtitle), tasks: g.tasks, subtitles: [g.subtitle] }));
  }, [tops, categories, view]);
  const requested = searchParams.get("subtitle") ?? "";
  const selectedSubtitle = groups.some((g) => g.subtitle === requested) ? requested : "";
  const visibleGroups = useMemo(() => (selectedSubtitle ? groups.filter((g) => g.subtitle === selectedSubtitle) : groups), [groups, selectedSubtitle]);
  const setOption = (key: "tableView" | "subtitle", value: string) => {
    const q = new URLSearchParams(searchParams.toString());
    if (value) q.set(key, value); else q.delete(key);
    if (key === "tableView") q.delete("subtitle"); // 보기를 바꾸면 묶음 선택은 초기화
    router.replace(`${pathname}?${q.toString()}`, { scroll: false });
  };
  return { view, groups, selectedSubtitle, visibleGroups, setOption };
}

export function SubtitleBar({ sv, count, unit = "태스크" }: {
  sv: ReturnType<typeof useSubtitleView<{ title: string }>>; count: number; unit?: string;
}) {
  const { view, groups, selectedSubtitle, setOption } = sv;
  const { editable } = useContext(Ctx);
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-[13px] font-medium text-sub">
        보기
        <select aria-label="태스크 보기" className="input w-auto min-w-[150px]" value={view} onChange={(e) => setOption("tableView", e.target.value)}>
          <option value="all">전체 보기</option>
          <option value="category">대분류별 보기</option>
          <option value="subtitle">[소제목]별 보기</option>
        </select>
      </label>
      {view !== "all" && (
        <label className="flex items-center gap-2 text-[13px] font-medium text-sub">
          {view === "category" ? "대분류" : "소제목"}
          <select aria-label={view === "category" ? "대분류 선택" : "소제목 선택"} className="input w-auto min-w-[170px]" value={selectedSubtitle} onChange={(e) => setOption("subtitle", e.target.value)}>
            <option value="">{view === "category" ? "모든 대분류" : "모든 소제목"} ({groups.length})</option>
            {groups.map((g) => <option key={g.subtitle} value={g.subtitle}>{g.label} ({g.tasks.length})</option>)}
          </select>
        </label>
      )}
      <span className="text-[12.5px] text-faint">{count}개 {unit}</span>
      {editable && view !== "all" && (
        <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => setEditing(true)}><Layers size={13} />분류 묶음 편집</button>
      )}
      {editing && <CategoryEditorFromCtx onClose={() => setEditing(false)} />}
    </div>
  );
}

function CategoryEditorFromCtx({ onClose }: { onClose: () => void }) {
  const { projectId, categories, allSubtitles } = useContext(Ctx);
  return <CategoryEditor projectId={projectId} categories={categories} allSubtitles={allSubtitles} onClose={onClose} />;
}

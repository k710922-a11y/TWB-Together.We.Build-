"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveCategories } from "@/app/actions/projects";
import { Modal, useAction } from "@/components/ui";
import type { Category } from "@/lib/task-groups";

const UNASSIGNED = "__none__";

/**
 * 분류 묶음 편집: 대분류 추가·이름 변경·순서·삭제, 소제목을 다른 대분류로 옮기기.
 * 각 소제목 칩의 드롭다운에서 대분류를 고르면 바로 옮겨진다. 저장해야 반영된다.
 */
export function CategoryEditor({ projectId, categories, allSubtitles, onClose }: {
  projectId: string; categories: Category[]; allSubtitles: string[]; onClose: () => void;
}) {
  const { exec, pending } = useAction();
  const router = useRouter();
  const [cats, setCats] = useState<Category[]>(() => categories.map((c) => ({ name: c.name, subtitles: c.subtitles.filter((s) => allSubtitles.includes(s)) })));
  const assigned = new Set(cats.flatMap((c) => c.subtitles));
  const unassigned = allSubtitles.filter((s) => !assigned.has(s));

  const move = (sub: string, to: string) => setCats((cs) => {
    const next = cs.map((c) => ({ ...c, subtitles: c.subtitles.filter((s) => s !== sub) }));
    const target = next.findIndex((_, i) => String(i) === to);
    if (target >= 0) next[target].subtitles.push(sub);
    return next;
  });
  const rename = (i: number, name: string) => setCats((cs) => cs.map((c, j) => (j === i ? { ...c, name } : c)));
  const remove = (i: number) => setCats((cs) => cs.filter((_, j) => j !== i));
  const shift = (i: number, d: -1 | 1) => setCats((cs) => {
    const j = i + d;
    if (j < 0 || j >= cs.length) return cs;
    const n = [...cs]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const Chip = ({ sub, at }: { sub: string; at: string }) => (
    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-white py-0.5 pl-2.5 pr-1 text-[12.5px]">
      {sub === "미분류" ? "미분류" : `[${sub}]`}
      <select aria-label={`${sub} 대분류 옮기기`} value={at} onChange={(e) => move(sub, e.target.value)}
        className="h-6 cursor-pointer rounded-full bg-canvas px-1 text-[11.5px] text-sub outline-none">
        <option value={UNASSIGNED}>미지정</option>
        {cats.map((c, i) => <option key={i} value={String(i)}>→ {c.name || `대분류 ${i + 1}`}</option>)}
      </select>
    </span>
  );

  return (
    <Modal open onClose={onClose} title="분류 묶음 편집" width={720}>
      <p className="mb-3 text-[12.5px] text-sub">태스크 제목의 [소제목]을 대분류로 묶습니다. 태스크 제목은 바뀌지 않습니다. 소제목 옆 드롭다운으로 다른 대분류로 옮길 수 있어요.</p>
      <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
        {cats.map((c, i) => (
          <div key={i} className="rounded-xl border border-line p-3">
            <div className="flex items-center gap-2">
              <input className="input h-8 flex-1 font-semibold" value={c.name} placeholder={`대분류 ${i + 1} 이름`} onChange={(e) => rename(i, e.target.value)} />
              <span className="text-[12px] text-faint">{c.subtitles.length}개</span>
              <button type="button" aria-label="위로" onClick={() => shift(i, -1)} className="rounded p-1 text-faint hover:bg-canvas hover:text-ink"><ArrowUp size={14} /></button>
              <button type="button" aria-label="아래로" onClick={() => shift(i, 1)} className="rounded p-1 text-faint hover:bg-canvas hover:text-ink"><ArrowDown size={14} /></button>
              <button type="button" aria-label="대분류 삭제" title="삭제 (소제목은 미지정으로)" onClick={() => remove(i)} className="rounded p-1 text-faint hover:bg-[#fff1f3] hover:text-pri-high"><Trash2 size={14} /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {c.subtitles.length ? c.subtitles.map((s) => <Chip key={s} sub={s} at={String(i)} />) : <span className="text-[12px] text-faint">비어 있음 — 아래 미지정 소제목을 옮겨 오세요</span>}
            </div>
          </div>
        ))}
        <button type="button" className="flex items-center gap-1 text-[13px] text-brand" onClick={() => setCats((cs) => [...cs, { name: "", subtitles: [] }])}><Plus size={14} />대분류 추가</button>
        <div className="rounded-xl border border-dashed border-line bg-canvas/50 p-3">
          <div className="text-[12.5px] font-semibold text-sub">미지정 소제목 {unassigned.length}개 <span className="font-normal text-faint">· &lsquo;기타&rsquo;로 표시됩니다</span></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unassigned.length ? unassigned.map((s) => <Chip key={s} sub={s} at={UNASSIGNED} />) : <span className="text-[12px] text-faint">모두 묶였습니다 👍</span>}
          </div>
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={onClose}>취소</button>
        <button className="btn-primary" disabled={pending} onClick={() => exec(() => saveCategories(projectId, cats), {
          ok: "분류 묶음을 저장했습니다.", onOk: () => { onClose(); router.refresh(); },
        })}>저장</button>
      </div>
    </Modal>
  );
}

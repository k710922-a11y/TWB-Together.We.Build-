"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { renameProject } from "@/app/actions/projects";
import { Modal, useAction } from "@/components/ui";

/** 프로젝트 화면 제목: 클릭(또는 ✏)하면 그 자리에서 이름을 고친다. Enter 저장 · Esc 취소 */
export function EditableProjectTitle({ projectId, title, editable }: { projectId: string; title: string; editable: boolean }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(title);
  const { exec, pending } = useAction();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!editing) setV(title); }, [title, editing]);
  useEffect(() => { if (editing) inputRef.current?.select(); }, [editing]);

  const commit = () => {
    const next = v.trim();
    if (!next || next === title) { setV(title); setEditing(false); return; }
    exec(() => renameProject(projectId, next), {
      ok: "프로젝트 이름을 바꿨습니다.",
      onOk: () => { setEditing(false); router.refresh(); },
      onErr: () => inputRef.current?.focus(),
    });
  };

  if (!editable) return <h1 className="truncate text-[24px] font-bold tracking-tight">{title}</h1>;
  if (editing) {
    return (
      <input ref={inputRef} aria-label="프로젝트 이름" maxLength={100} disabled={pending}
        className="w-full min-w-[260px] max-w-[640px] rounded-lg border border-brand bg-white px-2 py-0.5 text-[24px] font-bold tracking-tight outline-none ring-2 ring-brand/15"
        value={v} onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit(); }
          if (e.key === "Escape") { setV(title); setEditing(false); }
        }} />
    );
  }
  return (
    <h1 className="group flex min-w-0 items-center gap-1.5">
      <button type="button" onClick={() => setEditing(true)} title="클릭해서 프로젝트 이름 변경"
        className="truncate rounded-lg px-1 -mx-1 text-left text-[24px] font-bold tracking-tight hover:bg-canvas">{title}</button>
      <button type="button" onClick={() => setEditing(true)} aria-label="프로젝트 이름 변경"
        className="shrink-0 rounded-md p-1.5 text-faint opacity-60 transition-opacity hover:bg-canvas hover:text-ink group-hover:opacity-100"><Pencil size={15} /></button>
    </h1>
  );
}

/** 목록 카드용 ✏ 버튼 → 이름 변경 창 */
export function RenameProjectButton({ projectId, title }: { projectId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(title);
  const { exec, pending } = useAction();
  const router = useRouter();
  return (
    <>
      <button type="button" aria-label={`${title} 프로젝트 이름 변경`} title="이름 변경"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setV(title); setOpen(true); }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-sub transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <Pencil size={15} aria-hidden="true" />
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="프로젝트 이름 변경" width={440}>
        <form onSubmit={(e) => {
          e.preventDefault();
          exec(() => renameProject(projectId, v), { ok: "프로젝트 이름을 바꿨습니다.", onOk: () => { setOpen(false); router.refresh(); } });
        }}>
          <label className="label">새 이름</label>
          <input autoFocus required maxLength={100} className="input" value={v} onChange={(e) => setV(e.target.value)} onFocus={(e) => e.target.select()} />
          <p className="mt-2 text-[12px] text-faint">태스크·미팅·자료실의 프로젝트 표시도 함께 바뀝니다.</p>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
            <button className="btn-primary" disabled={pending || !v.trim() || v.trim() === title}>변경</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

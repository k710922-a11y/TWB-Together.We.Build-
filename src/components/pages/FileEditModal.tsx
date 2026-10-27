"use client";

import { useState } from "react";
import { updateFileMeta } from "@/app/actions/library";
import { Modal, useAction } from "@/components/ui";

export type FileMeta = { id: string; name: string; category: string | null; note: string | null; projectId: string | null };

/** 파일·링크 정보 수정 (이름·분류·메모, 다른 프로젝트 섹션으로 옮기기) */
export function FileEditModal({ file, projects, categories = [], onClose }: {
  file: FileMeta; projects: { id: string; title: string }[]; categories?: string[]; onClose: () => void;
}) {
  const { exec, pending } = useAction();
  const [f, setF] = useState({ name: file.name, category: file.category ?? "", note: file.note ?? "", projectId: file.projectId ?? "" });
  return (
    <Modal open onClose={onClose} title="자료 정보 수정">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        exec(() => updateFileMeta(file.id, { name: f.name, category: f.category, note: f.note, projectId: f.projectId || null }), { ok: "저장했습니다.", onOk: onClose });
      }}>
        <div><label className="label">이름</label><input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">프로젝트 섹션</label>
            <select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
              <option value="">공통</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select></div>
          <div><label className="label">분류</label>
            <input className="input" list="file-cats" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="디자인 / 계약 / API 명세…" />
            <datalist id="file-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
        </div>
        <div><label className="label">메모</label><input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></div>
        <div className="flex justify-end gap-2 pt-1"><button type="button" className="btn-ghost" onClick={onClose}>취소</button><button className="btn-primary" disabled={pending}>저장</button></div>
      </form>
    </Modal>
  );
}

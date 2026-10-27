"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { Upload } from "lucide-react";
import { Modal, uploadFile, useToast } from "@/components/ui";
import { fmtBytes } from "@/lib/format";
import { MAX_FILE_MB } from "@/lib/limits";

export type PickFile = { id: string; kind: string; name: string; mime: string | null; url: string | null; size: number | null; projectId: string | null; category: string | null };

/** 위키 문서에 넣을 자료 고르기: 자료실에서 선택 / 새로 올리기 */
export function FilePicker({ files, projects, projectId, onPick, onClose }: {
  files: PickFile[]; projects: { id: string; title: string }[]; projectId: string | null;
  onPick: (picked: PickFile[]) => void; onClose: () => void;
}) {
  const [tab, setTab] = useState<"library" | "upload">("library");
  const [scope, setScope] = useState<string>(projectId ?? "");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const pname = (id: string | null) => projects.find((p) => p.id === id)?.title ?? "공통";

  const list = useMemo(() => files.filter((f) =>
    (scope === "*" || (f.projectId ?? "") === scope) && (!q || f.name.toLowerCase().includes(q.toLowerCase()))), [files, scope, q]);

  async function uploadAll(fl: FileList | File[]) {
    const arr = Array.from(fl);
    if (!arr.length) return;
    const done: PickFile[] = [];
    try {
      for (let i = 0; i < arr.length; i++) {
        const file = arr[i];
        setProgress(`${i + 1}/${arr.length} ${file.name} 0%`);
        const r = await uploadFile(file, { projectId, category: "위키 첨부" }, (p) => setProgress(`${i + 1}/${arr.length} ${file.name} ${Math.round(p * 100)}%`));
        done.push({ id: r.id, kind: "file", name: file.name, mime: file.type || null, url: null, size: file.size, projectId, category: "위키 첨부" });
      }
      onPick(done);
    } catch (e) {
      toast((e as Error).message, "err");
      if (done.length) onPick(done);
    } finally {
      setProgress(null);
    }
  }

  return (
    <Modal open onClose={onClose} title="파일 첨부" width={620}>
      <div className="mb-4 flex gap-4 border-b border-line text-[13.5px]">
        {(["library", "upload"] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={clsx("-mb-px border-b-2 pb-2", tab === k ? "border-brand font-semibold text-brand" : "border-transparent text-sub")}>
            {k === "library" ? "자료실에서 선택" : "새로 올리기"}
          </button>
        ))}
      </div>
      {tab === "library" ? (
        <>
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="파일 이름 검색" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input w-[180px]" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="*">모든 섹션</option>
              <option value="">공통</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <ul className="mt-3 max-h-[340px] divide-y divide-line overflow-y-auto rounded-lg border border-line">
            {list.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-sub">이 섹션에 자료가 없습니다. &lsquo;새로 올리기&rsquo;를 이용하세요.</li>}
            {list.map((f) => (
              <li key={f.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-canvas">
                  <input type="checkbox" className="accent-[#5b5bf0]" checked={sel.includes(f.id)}
                    onChange={(e) => setSel((s) => (e.target.checked ? [...s, f.id] : s.filter((x) => x !== f.id)))} />
                  <span className="shrink-0">{f.kind === "link" ? "🔗" : f.mime?.startsWith("image/") ? "🖼️" : "📎"}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">{f.name}</span>
                  <span className="shrink-0 text-[11.5px] text-faint">{scope === "*" ? `${pname(f.projectId)} · ` : ""}{f.kind === "link" ? "링크" : fmtBytes(f.size)}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[12px] text-faint">이미지는 본문에 바로 보이고(4MB 이하), 나머지는 내려받기 링크로 들어갑니다.</span>
            <div className="flex gap-2">
              <button className="btn-ghost" onClick={onClose}>취소</button>
              <button className="btn-primary" disabled={!sel.length} onClick={() => onPick(sel.map((id) => files.find((f) => f.id === id)!).filter(Boolean))}>
                {sel.length ? `${sel.length}개 넣기` : "넣기"}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div>
          <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (!progress) void uploadAll(e.dataTransfer.files); }}
            onClick={() => !progress && inputRef.current?.click()}
            className="cursor-pointer rounded-xl border-2 border-dashed border-line px-4 py-10 text-center hover:border-brand/50">
            <Upload className="mx-auto text-faint" size={22} />
            <p className="mt-2 text-[13.5px] font-semibold">{progress ? `올리는 중 · ${progress}` : "파일을 끌어다 놓거나 클릭해서 선택"}</p>
            <p className="mt-1 text-[12px] text-sub">여러 개 가능 · 1개당 {MAX_FILE_MB}MB까지 · 자료실 &lsquo;{pname(projectId)}&rsquo; 섹션에 &lsquo;위키 첨부&rsquo;로 함께 저장됩니다</p>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => e.target.files && void uploadAll(e.target.files)} />
          </div>
        </div>
      )}
    </Modal>
  );
}

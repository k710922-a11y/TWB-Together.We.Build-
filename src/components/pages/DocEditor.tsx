"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { deleteDoc, saveDoc } from "@/app/actions/library";
import { useAction } from "@/components/ui";
import { fmtStamp } from "@/lib/format";

type Doc = { id: string; title: string; folder: string; content: string; projectId: string | null; version: number; updatedAt: string; updatedBy: string | null };

export function DocEditor({ doc, editable, startEditing, projects }: { doc: Doc; editable: boolean; startEditing: boolean; projects: { id: string; title: string }[] }) {
  const [editing, setEditing] = useState(editable && startEditing);
  const [f, setF] = useState({ title: doc.title, folder: doc.folder, content: doc.content, projectId: doc.projectId ?? "" });
  const [version, setVersion] = useState(doc.version);
  const [html, setHtml] = useState("");
  const { exec, pending } = useAction();
  const router = useRouter();
  const dirty = f.content !== doc.content || f.title !== doc.title || f.folder !== doc.folder || (f.projectId || null) !== doc.projectId;
  const source = editing ? f.content : doc.content;
  useEffect(() => { setHtml(DOMPurify.sanitize(marked.parse(source, { async: false }) as string)); }, [source]);
  useEffect(() => { if (!editing) { setF({ title: doc.title, folder: doc.folder, content: doc.content, projectId: doc.projectId ?? "" }); setVersion(doc.version); } }, [doc, editing]);
  useEffect(() => {
    if (!editing || !dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [editing, dirty]);
  const save = () => exec(() => saveDoc(doc.id, version, { ...f, projectId: f.projectId || null }), { ok: "저장했습니다.", onOk: (d) => { setVersion(d.version); setEditing(false); } });
  const projectName = useMemo(() => projects.find((p) => p.id === doc.projectId)?.title ?? "공통", [projects, doc.projectId]);

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-5 py-7 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] text-sub"><Link href="/library" className="hover:text-brand">자료실</Link> / {doc.folder} · {projectName}</div>
        {editable && (editing ? (
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => (!dirty || confirm("저장하지 않은 변경 사항을 버릴까요?")) && setEditing(false)}>취소</button>
            <button className="btn-primary btn-sm" disabled={pending} onClick={save}>저장</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-danger btn-sm" onClick={() => confirm("문서를 삭제할까요?") && exec(() => deleteDoc(doc.id), { onOk: () => router.push("/library") })}>삭제</button>
            <button className="btn-primary btn-sm" onClick={() => setEditing(true)}>편집</button>
          </div>
        ))}
      </div>
      {editing ? (
        <>
          <input className="w-full text-[24px] font-bold outline-none" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="flex gap-2">
            <input className="input w-[200px]" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} placeholder="폴더" />
            <select className="input w-[200px]" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
              <option value="">공통</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <textarea className="textarea min-h-[60vh] font-mono text-[13px] leading-relaxed" value={f.content}
              onChange={(e) => setF({ ...f, content: e.target.value })}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } }} />
            <div className="card prose-twb min-h-[60vh] overflow-y-auto p-5" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <p className="text-[12px] text-faint">마크다운 지원 · Ctrl+S 저장 · 다른 팀원이 먼저 저장하면 덮어쓰지 않고 알려 드립니다.</p>
        </>
      ) : (
        <article className="card p-6 lg:p-8">
          <div className="prose-twb" dangerouslySetInnerHTML={{ __html: html }} />
          <p className="mt-8 border-t border-line pt-3 text-[12px] text-faint">마지막 수정: {doc.updatedBy ?? "—"} · {fmtStamp(doc.updatedAt)}</p>
        </article>
      )}
    </div>
  );
}

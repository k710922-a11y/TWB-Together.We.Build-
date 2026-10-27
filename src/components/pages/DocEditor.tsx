"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { Paperclip } from "lucide-react";
import { deleteDoc, saveDoc } from "@/app/actions/library";
import { uploadFile, useAction, useToast } from "@/components/ui";
import { fmtBytes, fmtStamp } from "@/lib/format";
import { fileIdsIn, fileMarkdown } from "@/lib/file-refs";
import { FilePicker, type PickFile } from "./FilePicker";

type Doc = { id: string; title: string; folder: string; content: string; projectId: string | null; version: number; updatedAt: string; updatedBy: string | null };

/** 마크다운 → 안전한 HTML. 자료실 이미지는 원본 주소로, 삭제된 파일 링크는 표시만 바꾼다 */
function render(md: string, known: Set<string>) {
  let html = DOMPurify.sanitize(marked.parse(md, { async: false }) as string);
  html = html.replace(/src="\/files\/([0-9a-f-]{36})"/gi, (_, id) => `src="/api/files/${id}?raw=1" loading="lazy"`);
  html = html.replace(/href="\/files\/([0-9a-f-]{36})"/gi, (m, id) => (known.has(id.toLowerCase()) ? m : `${m} data-missing="1" title="자료실에서 삭제된 파일"`));
  return html;
}

export function DocEditor({ doc, editable, startEditing, projects, files }: {
  doc: Doc; editable: boolean; startEditing: boolean; projects: { id: string; title: string }[]; files: PickFile[];
}) {
  const [editing, setEditing] = useState(editable && startEditing);
  const [f, setF] = useState({ title: doc.title, folder: doc.folder, content: doc.content, projectId: doc.projectId ?? "" });
  const [version, setVersion] = useState(doc.version);
  const [html, setHtml] = useState("");
  const [picker, setPicker] = useState(false);
  const [extra, setExtra] = useState<PickFile[]>([]); // 이번 편집에서 새로 올린 파일
  const [uploading, setUploading] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const { exec, pending } = useAction();
  const toast = useToast();
  const router = useRouter();

  const allFiles = useMemo(() => [...files, ...extra.filter((x) => !files.some((y) => y.id === x.id))], [files, extra]);
  const known = useMemo(() => new Set(allFiles.map((x) => x.id)), [allFiles]);
  const dirty = f.content !== doc.content || f.title !== doc.title || f.folder !== doc.folder || (f.projectId || null) !== doc.projectId;
  const source = editing ? f.content : doc.content;
  useEffect(() => { setHtml(render(source, known)); }, [source, known]);
  useEffect(() => { if (!editing) { setF({ title: doc.title, folder: doc.folder, content: doc.content, projectId: doc.projectId ?? "" }); setVersion(doc.version); } }, [doc, editing]);
  useEffect(() => {
    if (!editing || !dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [editing, dirty]);

  const save = () => exec(() => saveDoc(doc.id, version, { ...f, projectId: f.projectId || null }), { ok: "저장했습니다.", onOk: (d) => { setVersion(d.version); setEditing(false); router.refresh(); } });
  const projectName = projects.find((p) => p.id === doc.projectId)?.title ?? "공통";

  /** 커서 위치에 파일 마크다운 삽입 */
  const insertFiles = (picked: PickFile[]) => {
    if (!picked.length) return;
    setExtra((x) => [...x, ...picked]);
    const text = picked.map(fileMarkdown).join("\n");
    const ta = taRef.current;
    setF((cur) => {
      const pos = ta ? ta.selectionStart : cur.content.length;
      const before = cur.content.slice(0, pos);
      const after = cur.content.slice(pos);
      // 마크다운에서 앞뒤 문장과 붙지 않도록 빈 줄로 감싼다
      const pre = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const post = after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
      return { ...cur, content: `${before}${pre}${text.split("\n").join("\n\n")}${post}${after}` };
    });
    setPicker(false);
  };

  /** 편집창에 끌어다 놓거나 붙여 넣은 파일을 바로 올려서 삽입 */
  const uploadAndInsert = async (list: File[]) => {
    const out: PickFile[] = [];
    try {
      for (const [i, file] of list.entries()) {
        const named = file.name && file.name !== "image.png" ? file : new File([file], `붙여넣은 이미지 ${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.png`, { type: file.type });
        setUploading(`${i + 1}/${list.length} ${named.name}`);
        const r = await uploadFile(named, { projectId: f.projectId || null, category: "위키 첨부" });
        out.push({ id: r.id, kind: "file", name: named.name, mime: named.type || null, url: null, size: named.size, projectId: f.projectId || null, category: "위키 첨부" });
      }
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setUploading(null); insertFiles(out); }
  };

  // 본문이 참조하는 파일 목록 (편집 중엔 현재 내용 기준)
  const linked = fileIdsIn(source).map((id) => allFiles.find((x) => x.id === id) ?? { id, missing: true as const });

  return (
    <div className="mx-auto max-w-[1200px] space-y-4 px-5 py-7 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12.5px] text-sub"><Link href="/library" className="hover:text-brand">자료실</Link> / {doc.folder} · {projectName}</div>
        {editable && (editing ? (
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" onClick={() => (!dirty || confirm("저장하지 않은 변경 사항을 버릴까요?")) && setEditing(false)}>취소</button>
            <button className="btn-primary btn-sm" disabled={pending || !!uploading} onClick={save}>저장</button>
          </div>
        ) : (
          <div className="flex gap-2">
            <button className="btn-danger btn-sm" onClick={() => confirm("문서를 삭제할까요? (연결된 파일은 자료실에 그대로 남습니다)") && exec(() => deleteDoc(doc.id), { onOk: () => router.push("/library") })}>삭제</button>
            <button className="btn-primary btn-sm" onClick={() => setEditing(true)}>편집</button>
          </div>
        ))}
      </div>
      {editing ? (
        <>
          <input className="w-full text-[24px] font-bold outline-none" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <div className="flex flex-wrap gap-2">
            <input className="input w-[200px]" value={f.folder} onChange={(e) => setF({ ...f, folder: e.target.value })} placeholder="폴더" />
            <select className="input w-[200px]" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })}>
              <option value="">공통</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
            <button type="button" className="btn-ghost" onClick={() => setPicker(true)} disabled={!!uploading}><Paperclip size={14} />파일 첨부</button>
            {uploading && <span className="self-center text-[12.5px] text-brand">올리는 중 · {uploading}</span>}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <textarea ref={taRef} className="textarea min-h-[60vh] font-mono text-[13px] leading-relaxed" value={f.content}
              onChange={(e) => setF({ ...f, content: e.target.value })}
              onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); } }}
              onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) e.preventDefault(); }}
              onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void uploadAndInsert(Array.from(e.dataTransfer.files)); } }}
              onPaste={(e) => { const fl = Array.from(e.clipboardData.files); if (fl.length) { e.preventDefault(); void uploadAndInsert(fl); } }} />
            <div className="card prose-twb min-h-[60vh] overflow-y-auto p-5" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
          <p className="text-[12px] text-faint">마크다운 지원 · Ctrl+S 저장 · 파일을 편집창에 끌어다 놓거나 이미지를 붙여 넣으면 자료실에 올라가고 본문에 들어갑니다 · 다른 팀원이 먼저 저장하면 덮어쓰지 않고 알려 드립니다.</p>
        </>
      ) : (
        <article className="card p-6 lg:p-8">
          <div className="prose-twb" dangerouslySetInnerHTML={{ __html: html }} />
          <p className="mt-8 border-t border-line pt-3 text-[12px] text-faint">마지막 수정: {doc.updatedBy ?? "—"} · {fmtStamp(doc.updatedAt)}</p>
        </article>
      )}

      {linked.length > 0 && (
        <section className="card p-5">
          <h2 className="text-[14px] font-bold">연결된 파일 <span className="font-normal text-faint">{linked.length}</span></h2>
          <ul className="mt-2 divide-y divide-line">
            {linked.map((x) => "missing" in x ? (
              <li key={x.id} className="py-2 text-[13px] text-faint line-through">자료실에서 삭제된 파일</li>
            ) : (
              <li key={x.id} className="flex items-center gap-3 py-2">
                <span>{x.kind === "link" ? "🔗" : x.mime?.startsWith("image/") ? "🖼️" : "📎"}</span>
                <Link href={`/files/${x.id}`} className="min-w-0 flex-1 truncate text-[13.5px] hover:text-brand">{x.name}</Link>
                <span className="text-[12px] text-faint">{projects.find((p) => p.id === x.projectId)?.title ?? "공통"} · {x.kind === "link" ? "링크" : fmtBytes(x.size)}</span>
                {x.kind === "file" && <Link href={`/files/${x.id}?download=1`} className="btn-ghost btn-sm">내려받기</Link>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {picker && <FilePicker files={allFiles} projects={projects} projectId={f.projectId || null} onPick={insertFiles} onClose={() => setPicker(false)} />}
    </div>
  );
}

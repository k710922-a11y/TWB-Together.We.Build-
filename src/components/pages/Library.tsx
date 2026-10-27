"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Download, ExternalLink, FileText, Link2, Trash2, Upload } from "lucide-react";
import { addLink, createDoc, deleteFile } from "@/app/actions/library";
import { downloadFile, Empty, Modal, uploadFile, useAction, useToast } from "@/components/ui";
import { fmtBytes, fmtStamp } from "@/lib/format";
import { MAX_FILE_MB } from "@/lib/limits";

type Doc = { id: string; title: string; folder: string; projectId: string | null; updatedAt: string; updatedBy: string | null };
type F = { id: string; kind: string; name: string; url: string | null; size: number | null; category: string | null; note: string | null; projectId: string | null; createdAt: string; uploadedBy: string | null };

export function Library({ docs, files, projects, editable, usedBytes }: { docs: Doc[]; files: F[]; projects: { id: string; title: string }[]; editable: boolean; usedBytes: number }) {
  const [project, setProject] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [modal, setModal] = useState<"doc" | "link" | null>(null);
  const [up, setUp] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { exec, pending } = useAction();
  const toast = useToast();
  const router = useRouter();
  const pname = (id: string | null) => projects.find((p) => p.id === id)?.title ?? "공통";

  const fDocs = docs.filter((d) => (!project || d.projectId === project) && (!q || d.title.toLowerCase().includes(q.toLowerCase())));
  const fFiles = files.filter((f) => (!project || f.projectId === project) && (!cat || f.category === cat) &&
    (!q || (f.name + (f.note ?? "")).toLowerCase().includes(q.toLowerCase())));
  const folders = useMemo(() => [...new Set(fDocs.map((d) => d.folder))], [fDocs]);
  const cats = [...new Set(files.map((f) => f.category).filter(Boolean))] as string[];

  async function onUpload(fl: FileList | null) {
    const file = fl?.[0];
    if (!file) return;
    try {
      setUp(0);
      await uploadFile(file, { projectId: project || null, category: cat || null }, setUp);
      toast("업로드했습니다.");
      router.refresh();
    } catch (e) { toast((e as Error).message, "err"); } finally { setUp(null); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="space-y-6 px-5 py-7 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold tracking-tight">자료실</h1>
        <div className="flex flex-wrap gap-2">
          <input className="input w-[180px]" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-[160px]" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">모든 프로젝트</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[16px] font-bold">문서 (위키) <span className="text-[13px] font-normal text-faint">{fDocs.length}</span></h2>
          {editable && <button className="btn-primary btn-sm" onClick={() => setModal("doc")}>+ 새 문서</button>}
        </div>
        {fDocs.length === 0 ? <Empty>기획서·아키텍처·가이드처럼 팀의 정본 문서를 여기에 모아 두세요.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {folders.map((folder) => (
              <div key={folder} className="card p-4">
                <h3 className="mb-2 text-[12.5px] font-bold text-sub">📁 {folder}</h3>
                <ul className="space-y-1">
                  {fDocs.filter((d) => d.folder === folder).map((d) => (
                    <li key={d.id}><Link href={`/library/docs/${d.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                      <FileText size={14} className="shrink-0 text-brand" /><span className="flex-1 truncate text-[13.5px]">{d.title}</span>
                      <span className="shrink-0 text-[11px] text-faint">{fmtStamp(d.updatedAt)}</span>
                    </Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold">파일 · 링크 <span className="text-[13px] font-normal text-faint">{fFiles.length} · 사용 {fmtBytes(usedBytes)}</span></h2>
          <div className="flex gap-2">
            {cats.length > 0 && (
              <select className="input h-7 w-[130px] text-[12px]" value={cat} onChange={(e) => setCat(e.target.value)}>
                <option value="">모든 분류</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
            {editable && <button className="btn-ghost btn-sm" onClick={() => setModal("link")}><Link2 size={13} />링크 등록</button>}
            {editable && <button className="btn-primary btn-sm" disabled={up !== null} onClick={() => fileRef.current?.click()}>
              <Upload size={13} />{up !== null ? `업로드 ${Math.round(up * 100)}%` : "파일 올리기"}</button>}
            <input ref={fileRef} type="file" hidden onChange={(e) => onUpload(e.target.files)} />
          </div>
        </div>
        <p className="mb-2 text-[12px] text-faint">파일은 1개당 {MAX_FILE_MB}MB까지. 큰 디자인 원본·영상은 Figma/드라이브 링크로 등록하는 걸 권장합니다.</p>
        {fFiles.length === 0 ? <Empty>디자인 에셋, 계약서, API 명세 등을 올리거나 링크로 등록하세요.</Empty> : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead className="bg-canvas text-left text-[12px] text-sub"><tr>
                <th className="px-4 py-2.5 font-medium">이름</th><th className="px-3 font-medium">분류</th><th className="px-3 font-medium">프로젝트</th>
                <th className="px-3 font-medium">크기</th><th className="px-3 font-medium">올린 사람</th><th className="w-16" />
              </tr></thead>
              <tbody className="divide-y divide-line">
                {fFiles.map((f) => (
                  <tr key={f.id} className="hover:bg-canvas/60">
                    <td className="max-w-[320px] px-4 py-2.5">
                      {f.kind === "link"
                        ? <a href={f.url!} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-medium text-brand hover:underline"><ExternalLink size={13} className="shrink-0" /><span className="truncate">{f.name}</span></a>
                        : <button onClick={() => downloadFile(f.id).catch((e) => toast((e as Error).message, "err"))} className="flex items-center gap-1.5 text-left font-medium hover:text-brand"><Download size={13} className="shrink-0" /><span className="truncate">{f.name}</span></button>}
                      {f.note && <div className="truncate text-[11.5px] text-faint">{f.note}</div>}
                    </td>
                    <td className="px-3 text-sub">{f.category ?? "—"}</td>
                    <td className="px-3 text-sub">{pname(f.projectId)}</td>
                    <td className="px-3 text-sub">{f.kind === "link" ? "링크" : fmtBytes(f.size)}</td>
                    <td className="px-3 text-sub">{f.uploadedBy ?? "—"} · {fmtStamp(f.createdAt)}</td>
                    <td className="px-3 text-right">
                      {editable && <button onClick={() => confirm(`'${f.name}'을(를) 삭제할까요?`) && exec(() => deleteFile(f.id))} className="p-1 text-faint hover:text-pri-high"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={modal === "doc"} onClose={() => setModal(null)} title="새 문서">
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          exec(() => createDoc({ title: String(fd.get("title")), folder: String(fd.get("folder")), projectId: String(fd.get("projectId")) || null }),
            { onOk: (d) => router.push(`/library/docs/${d.id}?edit=1`) });
        }}>
          <div><label className="label">제목</label><input name="title" required className="input" placeholder="예: K-thang 아키텍처 구조도" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">폴더</label><input name="folder" className="input" list="folders" placeholder="일반" defaultValue={folders[0] ?? ""} />
              <datalist id="folders">{[...new Set(docs.map((d) => d.folder))].map((f) => <option key={f} value={f} />)}</datalist></div>
            <div><label className="label">프로젝트</label><select name="projectId" className="input" defaultValue={project}><option value="">공통</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setModal(null)}>취소</button><button className="btn-primary" disabled={pending}>만들기</button></div>
        </form>
      </Modal>

      <Modal open={modal === "link"} onClose={() => setModal(null)} title="링크 등록">
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          exec(() => addLink({ name: String(fd.get("name")), url: String(fd.get("url")), category: String(fd.get("category")), note: String(fd.get("note")), projectId: String(fd.get("projectId")) || null }),
            { ok: "등록했습니다.", onOk: () => setModal(null) });
        }}>
          <div><label className="label">주소</label><input name="url" required className="input" placeholder="https://www.figma.com/…" /></div>
          <div><label className="label">이름</label><input name="name" className="input" placeholder="예: 메인 화면 Figma" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">분류</label><input name="category" className="input" list="cats" placeholder="디자인 / 계약 / API 명세…" />
              <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div><label className="label">프로젝트</label><select name="projectId" className="input" defaultValue={project}><option value="">공통</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          </div>
          <div><label className="label">메모</label><input name="note" className="input" /></div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setModal(null)}>취소</button><button className="btn-primary" disabled={pending}>등록</button></div>
        </form>
      </Modal>
      <span className={clsx("hidden")} />
    </div>
  );
}

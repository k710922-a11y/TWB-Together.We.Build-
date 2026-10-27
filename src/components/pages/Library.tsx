"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronRight, Download, ExternalLink, FileText, Link2, Pencil, Trash2, Upload } from "lucide-react";
import { addLink, createDoc, deleteFile } from "@/app/actions/library";
import { downloadFile, Empty, Modal, uploadFile, useAction, useToast } from "@/components/ui";
import { fmtBytes, fmtStamp } from "@/lib/format";
import { MAX_FILE_MB } from "@/lib/limits";
import { FileEditModal } from "./FileEditModal";

type Doc = { id: string; title: string; folder: string; projectId: string | null; updatedAt: string; updatedBy: string | null };
type F = { id: string; kind: string; name: string; url: string | null; size: number | null; mime: string | null; category: string | null; note: string | null; projectId: string | null; createdAt: string; uploadedBy: string | null };
type Project = { id: string; title: string };
type DocRefs = Record<string, { id: string; title: string }[]>;

export function Library({ docs, files, projects, editable, usedBytes, docRefs }: {
  docs: Doc[]; files: F[]; projects: Project[]; editable: boolean; usedBytes: number; docRefs: DocRefs;
}) {
  const [project, setProject] = useState("");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [docModal, setDocModal] = useState(false);
  const { exec, pending } = useAction();
  const router = useRouter();

  const fDocs = docs.filter((d) => (!project || (project === "common" ? !d.projectId : d.projectId === project)) && (!q || d.title.toLowerCase().includes(q.toLowerCase())));
  const folders = useMemo(() => [...new Set(fDocs.map((d) => d.folder))], [fDocs]);
  const cats = [...new Set(files.map((f) => f.category).filter(Boolean))] as string[];
  const fFiles = files.filter((f) => (!cat || f.category === cat) && (!q || (f.name + (f.note ?? "")).toLowerCase().includes(q.toLowerCase())));

  // 파일·링크 섹션: 공통 + 프로젝트별 (프로젝트 필터를 고르면 해당 섹션만)
  const sections: { key: string; projectId: string | null; title: string }[] = [
    { key: "common", projectId: null, title: "공통" },
    ...projects.map((p) => ({ key: p.id, projectId: p.id, title: p.title })),
  ].filter((s) => !project || s.key === project);
  // 보관·삭제된 프로젝트에 남아 있는 자료도 잃어버리지 않도록 공통 섹션에 함께 보여 준다
  const knownProject = new Set(projects.map((p) => p.id));
  const inSection = (s: { projectId: string | null }) => (f: F) =>
    s.projectId ? f.projectId === s.projectId : !f.projectId || !knownProject.has(f.projectId);

  return (
    <div className="space-y-6 px-5 py-7 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[24px] font-bold tracking-tight">자료실</h1>
        <div className="flex flex-wrap gap-2">
          <input className="input w-[180px]" placeholder="검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input w-[170px]" value={project} onChange={(e) => setProject(e.target.value)}>
            <option value="">모든 프로젝트</option>
            <option value="common">공통</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
      </div>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-[16px] font-bold">문서 (위키) <span className="text-[13px] font-normal text-faint">{fDocs.length}</span></h2>
          {editable && <button className="btn-primary btn-sm" onClick={() => setDocModal(true)}>+ 새 문서</button>}
        </div>
        {fDocs.length === 0 ? <Empty>기획서·아키텍처·가이드처럼 팀의 정본 문서를 여기에 모아 두세요. 문서 편집 화면에서 자료실 파일을 바로 첨부할 수 있습니다.</Empty> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {folders.map((folder) => (
              <div key={folder} className="card p-4">
                <h3 className="mb-2 text-[12.5px] font-bold text-sub">📁 {folder}</h3>
                <ul className="space-y-1">
                  {fDocs.filter((d) => d.folder === folder).map((d) => {
                    const n = Object.values(docRefs).filter((ds) => ds.some((x) => x.id === d.id)).length;
                    return (
                      <li key={d.id}><Link href={`/library/docs/${d.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                        <FileText size={14} className="shrink-0 text-brand" /><span className="flex-1 truncate text-[13.5px]">{d.title}</span>
                        {n > 0 && <span className="shrink-0 rounded bg-brand-50 px-1.5 text-[11px] text-brand" title="본문에 연결된 파일">📎 {n}</span>}
                        <span className="shrink-0 text-[11px] text-faint">{fmtStamp(d.updatedAt)}</span>
                      </Link></li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[16px] font-bold">파일 · 링크 <span className="text-[13px] font-normal text-faint">{fFiles.length} · 사용 {fmtBytes(usedBytes)}</span></h2>
          {cats.length > 0 && (
            <select className="input h-8 w-[150px] text-[12.5px]" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">모든 분류</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <p className="mb-3 text-[12px] text-faint">프로젝트별 섹션에 바로 올리거나, 파일을 섹션 위로 끌어다 놓으세요. 1개당 {MAX_FILE_MB}MB까지 · 큰 디자인 원본·영상은 Figma/드라이브 링크로 등록하는 걸 권장합니다.</p>
        <div className="space-y-4">
          {sections.map((s) => (
            <FileSection key={s.key} title={s.title} projectId={s.projectId} files={fFiles.filter(inSection(s))}
              projects={projects} categories={cats} editable={editable} docRefs={docRefs} filterCat={cat} filtered={!!(q || cat)} />
          ))}
        </div>
      </section>

      <Modal open={docModal} onClose={() => setDocModal(false)} title="새 문서">
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
            <div><label className="label">프로젝트</label><select name="projectId" className="input" defaultValue={project === "common" ? "" : project}><option value="">공통</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setDocModal(false)}>취소</button><button className="btn-primary" disabled={pending}>만들기</button></div>
        </form>
      </Modal>
    </div>
  );
}

/** 프로젝트 섹션 하나: 자체 업로드·링크 등록·드래그 업로드·목록 */
function FileSection({ title, projectId, files, projects, categories, editable, docRefs, filterCat, filtered }: {
  title: string; projectId: string | null; files: F[]; projects: Project[]; categories: string[];
  editable: boolean; docRefs: DocRefs; filterCat: string; filtered: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [drag, setDrag] = useState(false);
  const [up, setUp] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editing, setEditing] = useState<F | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { exec, pending } = useAction();
  const toast = useToast();
  const router = useRouter();
  const bytes = files.reduce((n, f) => n + (f.kind === "file" ? f.size ?? 0 : 0), 0);

  async function onUpload(list: FileList | File[] | null) {
    const arr = Array.from(list ?? []);
    if (!arr.length) return;
    let ok = 0;
    try {
      for (const [i, file] of arr.entries()) {
        setUp(`${i + 1}/${arr.length} 0%`);
        await uploadFile(file, { projectId, category: filterCat || null }, (p) => setUp(`${i + 1}/${arr.length} ${Math.round(p * 100)}%`));
        ok++;
      }
      toast(`${title}에 ${ok}개를 올렸습니다.`);
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setUp(null);
      if (fileRef.current) fileRef.current.value = "";
      if (ok) router.refresh();
    }
  }

  if (filtered && files.length === 0) return null;
  return (
    <section aria-label={`${title} 자료`}
      onDragOver={(e) => { if (editable && e.dataTransfer.types.includes("Files")) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrag(false); }}
      onDrop={(e) => { if (!editable) return; e.preventDefault(); setDrag(false); if (!up) void onUpload(e.dataTransfer.files); }}
      className={clsx("card overflow-hidden transition-shadow", drag && "ring-2 ring-brand/50")}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-canvas/60 px-4 py-2.5">
        <button type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((c) => !c)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronRight size={15} className={clsx("shrink-0 text-sub transition-transform", !collapsed && "rotate-90")} />
          <span className={clsx("truncate text-[14px] font-bold", projectId ? "text-ink" : "text-sub")}>{projectId ? title : "📂 공통"}</span>
          <span className="shrink-0 text-[12px] text-faint">{files.length}개{bytes ? ` · ${fmtBytes(bytes)}` : ""}</span>
          {projectId && <Link href={`/projects/${projectId}`} onClick={(e) => e.stopPropagation()} className="shrink-0 text-[12px] text-brand hover:underline">보드 →</Link>}
        </button>
        {editable && (
          <div className="flex gap-1.5">
            <button className="btn-ghost btn-sm" onClick={() => setLinkOpen(true)}><Link2 size={13} />링크 등록</button>
            <button className="btn-primary btn-sm" disabled={up !== null} onClick={() => fileRef.current?.click()}>
              <Upload size={13} />{up !== null ? `업로드 ${up}` : "파일 올리기"}
            </button>
            <input ref={fileRef} type="file" multiple hidden onChange={(e) => void onUpload(e.target.files)} />
          </div>
        )}
      </header>
      {!collapsed && (files.length === 0 ? (
        <p className="px-4 py-5 text-center text-[13px] text-sub">{drag ? "여기에 놓으면 이 섹션에 올라갑니다" : editable ? "파일을 여기로 끌어다 놓거나 ‘파일 올리기’를 누르세요." : "자료가 없습니다."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-[13px]">
            <thead className="text-left text-[12px] text-sub"><tr className="border-b border-line">
              <th className="px-4 py-2 font-medium">이름</th><th className="px-3 font-medium">분류</th><th className="px-3 font-medium">위키</th>
              <th className="px-3 font-medium">크기</th><th className="px-3 font-medium">올린 사람</th><th className="w-20" />
            </tr></thead>
            <tbody className="divide-y divide-line">
              {files.map((f) => {
                const refs = docRefs[f.id] ?? [];
                return (
                  <tr key={f.id} className="hover:bg-canvas/60">
                    <td className="max-w-[340px] px-4 py-2.5">
                      {f.kind === "link"
                        ? <a href={f.url!} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 font-medium text-brand hover:underline"><ExternalLink size={13} className="shrink-0" /><span className="truncate">{f.name}</span></a>
                        : <Link href={`/files/${f.id}`} className="flex items-center gap-1.5 font-medium hover:text-brand"><span className="shrink-0">{f.mime?.startsWith("image/") ? "🖼️" : "📎"}</span><span className="truncate">{f.name}</span></Link>}
                      {f.note && <div className="truncate text-[11.5px] text-faint">{f.note}</div>}
                    </td>
                    <td className="px-3 text-sub">{f.category ?? "—"}</td>
                    <td className="px-3">
                      {refs.length ? (
                        <Link href={`/library/docs/${refs[0].id}`} title={refs.map((r) => r.title).join(", ")} className="inline-flex max-w-[160px] items-center gap-1 truncate rounded bg-brand-50 px-1.5 py-0.5 text-[11.5px] text-brand">
                          📄 {refs[0].title}{refs.length > 1 && ` 외 ${refs.length - 1}`}
                        </Link>
                      ) : <span className="text-faint">—</span>}
                    </td>
                    <td className="px-3 text-sub">{f.kind === "link" ? "링크" : fmtBytes(f.size)}</td>
                    <td className="px-3 text-sub">{f.uploadedBy ?? "—"} · {fmtStamp(f.createdAt)}</td>
                    <td className="px-3 text-right whitespace-nowrap">
                      {f.kind === "file" && <button title="내려받기" onClick={() => downloadFile(f.id).catch((e) => toast((e as Error).message, "err"))} className="p-1 text-faint hover:text-ink"><Download size={14} /></button>}
                      {editable && <button title="정보 수정 · 다른 섹션으로 옮기기" onClick={() => setEditing(f)} className="p-1 text-faint hover:text-ink"><Pencil size={14} /></button>}
                      {editable && <button title="삭제" onClick={() => confirm(`'${f.name}'을(를) 삭제할까요?${refs.length ? `\n이 파일을 넣은 위키 문서 ${refs.length}건에서는 '삭제된 파일'로 표시됩니다.` : ""}`) && exec(() => deleteFile(f.id))} className="p-1 text-faint hover:text-pri-high"><Trash2 size={14} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      {editing && <FileEditModal file={editing} projects={projects} categories={categories} onClose={() => setEditing(null)} />}
      <Modal open={linkOpen} onClose={() => setLinkOpen(false)} title={`링크 등록 · ${title}`}>
        <form className="space-y-3" onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          exec(() => addLink({ name: String(fd.get("name")), url: String(fd.get("url")), category: String(fd.get("category")), note: String(fd.get("note")), projectId }),
            { ok: "등록했습니다.", onOk: () => setLinkOpen(false) });
        }}>
          <div><label className="label">주소</label><input name="url" required className="input" placeholder="https://www.figma.com/…" /></div>
          <div><label className="label">이름</label><input name="name" className="input" placeholder="예: 메인 화면 Figma" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">분류</label><input name="category" className="input" list={`cats-${projectId ?? "common"}`} defaultValue={filterCat} placeholder="디자인 / 계약 / API 명세…" />
              <datalist id={`cats-${projectId ?? "common"}`}>{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div><label className="label">메모</label><input name="note" className="input" /></div>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setLinkOpen(false)}>취소</button><button className="btn-primary" disabled={pending}>등록</button></div>
        </form>
      </Modal>
    </section>
  );
}

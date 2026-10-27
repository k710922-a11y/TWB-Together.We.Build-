"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { deleteFile } from "@/app/actions/library";
import { downloadFile, useAction, useToast } from "@/components/ui";
import { FileEditModal } from "./FileEditModal";

export function FileActions({ file, projects, editable, autoDownload, docCount }: {
  file: { id: string; kind: string; name: string; url: string | null; category: string | null; note: string | null; projectId: string | null };
  projects: { id: string; title: string }[]; editable: boolean; autoDownload: boolean; docCount: number;
}) {
  const [progress, setProgress] = useState<number | null>(null);
  const [edit, setEdit] = useState(false);
  const started = useRef(false);
  const toast = useToast();
  const router = useRouter();
  const { exec } = useAction();

  const download = async () => {
    setProgress(0);
    try { await downloadFile(file.id, setProgress); } catch (e) { toast((e as Error).message, "err"); }
    finally { setProgress(null); }
  };
  useEffect(() => {
    if (autoDownload && file.kind === "file" && !started.current) { started.current = true; void download(); }
  }, [autoDownload, file.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {file.kind === "file"
        ? <button className="btn-primary" onClick={download} disabled={progress !== null}><Download size={14} />{progress !== null ? `내려받는 중 ${Math.round(progress * 100)}%` : "내려받기"}</button>
        : <a className="btn-primary" href={file.url!} target="_blank" rel="noreferrer"><ExternalLink size={14} />열기</a>}
      {editable && <button className="btn-ghost" onClick={() => setEdit(true)}><Pencil size={14} />정보 수정</button>}
      {editable && (
        <button className="btn-danger" onClick={() => confirm(`'${file.name}'을(를) 삭제할까요?${docCount ? `\n이 파일을 넣은 위키 문서 ${docCount}건에서는 '삭제된 파일'로 표시됩니다.` : ""}`) &&
          exec(() => deleteFile(file.id), { ok: "삭제했습니다.", onOk: () => router.push("/library") })}><Trash2 size={14} />삭제</button>
      )}
      {edit && <FileEditModal file={file} projects={projects} onClose={() => setEdit(false)} />}
    </div>
  );
}

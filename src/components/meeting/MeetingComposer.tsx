"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { FileAudio, Upload } from "lucide-react";
import { createMeeting } from "@/app/actions/meetings";
import { useToast } from "@/components/ui";
import { fmtBytes, todayStr } from "@/lib/format";
import { AUDIO_ACCEPT, measureDurationMin, uploadAudio } from "./audio";

/** 회의 등록: 녹음 업로드(선택) + 메모 → 생성 후 이동 */
export function MeetingComposer({ projects, fixedProjectId, after, onCancel }: {
  projects: { id: string; title: string }[]; fixedProjectId?: string;
  after: (meetingId: string) => string; onCancel?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ projectId: fixedProjectId ?? projects[0]?.id ?? "", title: "", heldOn: todayStr(), attendees: "", notes: "" });

  const pick = (fl: FileList | null) => {
    const x = fl?.[0];
    if (!x) return;
    if (!/^audio\//.test(x.type) && !/\.(m4a|mp3|wav|aac|ogg|flac|webm|opus|mp4)$/i.test(x.name)) { toast("오디오 파일만 올릴 수 있습니다.", "err"); return; }
    setFile(x);
    if (!f.title) setF((s) => ({ ...s, title: x.name.replace(/\.[^.]+$/, "") }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file && !f.notes.trim()) { toast("녹음 파일을 올리거나 회의 메모를 입력해 주세요.", "err"); return; }
    setBusy(true);
    try {
      const durationMin = file ? await measureDurationMin(file) : null;
      const r = await createMeeting({ ...f, durationMin, audio: file ? { name: file.name, mime: file.type, size: file.size } : null });
      if (!r.ok) { toast(r.error, "err"); return; }
      if (file) {
        setProgress(0);
        await uploadAudio(r.data.id, file, setProgress);
        toast("업로드 완료 — 변환을 시작합니다.");
      }
      router.push(after(r.data.id));
      router.refresh();
    } catch (err) {
      toast((err as Error).message, "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files); }}
        onClick={() => !busy && inputRef.current?.click()}
        className={clsx("cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors", drag ? "border-brand bg-brand-50" : "border-line hover:border-brand/50")}>
        <input ref={inputRef} type="file" accept={AUDIO_ACCEPT} hidden onChange={(e) => pick(e.target.files)} />
        {file ? (
          <div className="flex items-center gap-3 text-left">
            <FileAudio className="shrink-0 text-brand" size={22} />
            <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-semibold">{file.name}</div><div className="text-[12px] text-sub">{fmtBytes(file.size)}</div></div>
            {!busy && <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="text-[12px] text-sub hover:text-pri-high">빼기</button>}
          </div>
        ) : (
          <>
            <Upload className="mx-auto text-faint" size={20} />
            <p className="mt-1.5 text-[13px] font-semibold">녹음 파일 업로드</p>
            <p className="mt-0.5 text-[12px] text-sub">.m4a, .mp3, .wav · 최대 2시간 이상도 가능 · 드래그하거나 선택</p>
          </>
        )}
        {progress !== null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas"><div className="h-full bg-brand transition-all" style={{ width: `${progress * 100}%` }} /></div>
        )}
      </div>

      {!fixedProjectId && (
        <div><label className="label">프로젝트</label>
          <select className="input" value={f.projectId} onChange={(e) => setF({ ...f, projectId: e.target.value })} required>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select></div>
      )}
      <div className="grid grid-cols-[1fr_150px] gap-2">
        <div><label className="label">회의 제목</label><input className="input" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="예: 주간 기획 회의" /></div>
        <div><label className="label">날짜</label><input type="date" className="input" required value={f.heldOn} onChange={(e) => setF({ ...f, heldOn: e.target.value })} /></div>
      </div>
      <div><label className="label">참석자 (선택)</label><input className="input" value={f.attendees} onChange={(e) => setF({ ...f, attendees: e.target.value })} placeholder="민수, 지우, 서연" /></div>
      <div><label className="label">메모 / 회의록 텍스트 (선택)</label>
        <textarea className="textarea" rows={3} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="녹음이 없으면 회의록을 붙여 넣어도 요약·할 일 추출이 됩니다." /></div>
      <div className="flex justify-end gap-2">
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>취소</button>}
        <button className="btn-primary" disabled={busy}>{busy ? (progress !== null ? `업로드 중 ${Math.round(progress * 100)}%` : "준비 중…") : "등록하고 정리 시작"}</button>
      </div>
    </form>
  );
}

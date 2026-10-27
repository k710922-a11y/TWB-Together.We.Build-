"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Check, FileAudio, Loader2, X } from "lucide-react";
import type { MeetingStep } from "@/lib/schema";
import { advanceMeeting, restartAudio, retryMeeting } from "@/app/actions/meetings";
import { useAction, useToast } from "@/components/ui";
import { fmtBytes } from "@/lib/format";
import { AUDIO_ACCEPT, measureDurationMin, uploadAudio } from "./audio";

type M = {
  id: string; status: string; steps: MeetingStep[] | null; error: string | null;
  audioName: string | null; audioSize: number | null; uploadedBytes: number; durationMin: number | null;
};

/** 처리 단계 표시 + 화면이 열려 있는 동안 다음 단계를 계속 진행 */
export function MeetingRunner({ m, editable }: { m: M; editable: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const { exec, pending } = useAction();
  const running = useRef(false);
  const [reupload, setReupload] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (m.status !== "processing" || running.current) return;
    running.current = true;
    let stop = false;
    (async () => {
      while (!stop) {
        const r = await advanceMeeting(m.id).catch(() => null);
        router.refresh();
        if (!r || !r.ok) { await new Promise((x) => setTimeout(x, 5000)); continue; }
        if (r.data.status !== "processing") break;
        if (r.data.wait) await new Promise((x) => setTimeout(x, r.data.wait));
      }
      running.current = false;
    })();
    return () => { stop = true; };
  }, [m.id, m.status, router]);

  async function doReupload(file: File) {
    try {
      const durationMin = await measureDurationMin(file);
      const r = await restartAudio(m.id, { name: file.name, mime: file.type, size: file.size }, durationMin);
      if (!r.ok) { toast(r.error, "err"); return; }
      setReupload(0);
      await uploadAudio(m.id, file, setReupload);
      setReupload(null);
      router.refresh();
    } catch (e) {
      setReupload(null);
      toast((e as Error).message, "err");
    }
  }

  const steps = m.steps ?? [];
  const uploadDone = m.status !== "uploading";
  return (
    <div>
      {m.audioName && (
        <div className="flex items-center gap-3 rounded-lg bg-canvas px-3.5 py-3">
          <FileAudio size={18} className="shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13.5px] font-medium">{m.audioName}</div>
            <div className="text-[11.5px] text-sub">{fmtBytes(m.audioSize)}{m.durationMin ? ` · 약 ${m.durationMin}분` : ""}</div>
          </div>
          <span className={clsx("shrink-0 text-[12.5px] font-semibold", uploadDone ? "text-st-done" : "text-pri-mid")}>
            {uploadDone ? "업로드 완료" : reupload !== null ? `업로드 ${Math.round(reupload * 100)}%` : "업로드 중단됨"}
          </span>
        </div>
      )}

      <ul className="mt-4 space-y-2.5">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2.5 text-[13.5px]">
            {s.state === "done" ? <Check size={15} className="text-st-done" />
              : s.state === "running" ? <Loader2 size={15} className="animate-spin text-brand" />
              : s.state === "failed" ? <X size={15} className="text-pri-high" />
              : <span className="ml-1 h-2 w-2 rounded-full bg-[#d6d9e3]" />}
            <span className={clsx(s.state === "pending" && "text-faint", s.state === "failed" && "text-pri-high")}>{s.label}</span>
          </li>
        ))}
      </ul>

      {m.status === "processing" && <p className="mt-3 text-[12px] text-sub">처리 중입니다. 이 화면을 닫아도 진행 상황은 저장되며, 다시 열면 이어서 처리됩니다.</p>}
      {m.status === "failed" && (
        <div className="mt-3 rounded-lg bg-[#fff1f3] px-3 py-2.5 text-[12.5px] text-pri-high">
          {m.error}
          {editable && (
            <div className="mt-2 flex gap-2">
              <button className="btn-ghost btn-sm" disabled={pending} onClick={() => exec(() => retryMeeting(m.id))}>이어서 처리</button>
              {m.audioName && <button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>녹음 다시 올리기</button>}
            </div>
          )}
        </div>
      )}
      {m.status === "uploading" && reupload === null && editable && (
        <div className="mt-3 rounded-lg bg-[#fff8ec] px-3 py-2.5 text-[12.5px] text-[#a86200]">
          녹음 업로드가 끝나지 않았습니다. 같은 파일을 다시 선택하면 처음부터 다시 올립니다.
          <div className="mt-2"><button className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>녹음 다시 올리기</button></div>
        </div>
      )}
      <input ref={fileRef} type="file" accept={AUDIO_ACCEPT} hidden onChange={(e) => e.target.files?.[0] && doReupload(e.target.files[0])} />
    </div>
  );
}

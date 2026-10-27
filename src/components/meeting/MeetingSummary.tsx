"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, RefreshCw } from "lucide-react";
import type { TaskRow, UserLite } from "@/lib/queries";
import { reanalyzeMeeting, updateMeetingText } from "@/app/actions/meetings";
import { useAction } from "@/components/ui";
import { fmtShort } from "@/lib/format";

export function MeetingSummary({ m, tasks, users, editable, projectId }: {
  m: { id: string; summary: string[] | null; decisions: string[] | null; status: string; notes: string | null; transcript: string | null };
  tasks: TaskRow[]; users: UserLite[]; editable: boolean; projectId: string | null;
}) {
  const [edit, setEdit] = useState(false);
  const [sum, setSum] = useState((m.summary ?? []).join("\n"));
  const [dec, setDec] = useState((m.decisions ?? []).join("\n"));
  const { exec, pending } = useAction();
  const summary = m.summary ?? [];
  const decisions = m.decisions ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold">요약</h3>
        {editable && m.status !== "processing" && (
          <div className="flex gap-1">
            {(m.notes || m.transcript) && (
              <button title="요약·할 일 다시 추출" onClick={() => confirm("요약과 할 일을 다시 뽑을까요? (이미 등록된 같은 이름의 태스크는 중복 생성하지 않습니다)") && exec(() => reanalyzeMeeting(m.id))}
                className="rounded p-1.5 text-faint hover:bg-canvas hover:text-ink"><RefreshCw size={14} /></button>
            )}
            <button title="요약 편집" onClick={() => setEdit((e) => !e)} className="rounded p-1.5 text-faint hover:bg-canvas hover:text-ink"><Pencil size={14} /></button>
          </div>
        )}
      </div>
      {edit ? (
        <div className="mt-2 space-y-2">
          <label className="label">요약 (한 줄에 하나)</label>
          <textarea className="textarea" rows={4} value={sum} onChange={(e) => setSum(e.target.value)} />
          <label className="label">결정 사항 (한 줄에 하나)</label>
          <textarea className="textarea" rows={3} value={dec} onChange={(e) => setDec(e.target.value)} />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost btn-sm" onClick={() => setEdit(false)}>취소</button>
            <button className="btn-primary btn-sm" disabled={pending} onClick={() => exec(() => updateMeetingText(m.id, { summary: sum.split("\n"), decisions: dec.split("\n") }), { onOk: () => setEdit(false) })}>저장</button>
          </div>
        </div>
      ) : summary.length ? (
        <ul className="mt-2.5 space-y-1.5 text-[13.5px] leading-relaxed">{summary.map((s, i) => <li key={i}>· {s}</li>)}</ul>
      ) : (
        <p className="mt-2 text-[13px] text-faint">{m.status === "processing" || m.status === "uploading" ? "정리하는 중입니다…" : "요약이 없습니다."}</p>
      )}
      {!edit && decisions.length > 0 && (
        <>
          <h4 className="mt-4 text-[13px] font-bold">결정 사항</h4>
          <ul className="mt-1.5 space-y-1 text-[13px]">{decisions.map((d, i) => <li key={i} className="rounded-md bg-st-done-bg/60 px-2.5 py-1.5">✓ {d}</li>)}</ul>
        </>
      )}

      <h3 className="mt-6 text-[15px] font-bold">자동 등록된 태스크</h3>
      {tasks.length ? (
        <ul className="mt-2.5 space-y-2">
          {tasks.map((t) => {
            const u = users.find((x) => x.id === t.assigneeId);
            return (
              <li key={t.id}>
                <Link href={`/projects/${projectId ?? t.projectId}?tab=table&task=${t.id}`} className="flex items-center gap-3 rounded-lg border border-line px-3.5 py-3 hover:border-brand/40">
                  <span className="flex-1 truncate text-[13.5px]">{t.title}</span>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand">자동 생성</span>
                  <span className="shrink-0 text-[12.5px] text-sub">{u?.name ?? "미배정"} · {t.dueDate ? fmtShort(t.dueDate) : "기한 없음"}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <p className="mt-2 text-[13px] text-faint">아직 없습니다.</p>}

      {(m.transcript || m.notes) && (
        <details className="mt-6">
          <summary className="cursor-pointer text-[13px] font-semibold text-sub">{m.transcript ? "녹취 전문 보기" : "회의 메모 보기"}</summary>
          <pre className="mt-2 max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-lg bg-canvas p-3 font-sans text-[12.5px] leading-relaxed">{m.transcript ?? m.notes}</pre>
        </details>
      )}
    </div>
  );
}

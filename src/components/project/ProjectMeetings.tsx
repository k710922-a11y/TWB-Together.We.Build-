"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { MeetingDetail, UserLite } from "@/lib/queries";
import { MeetingComposer } from "@/components/meeting/MeetingComposer";
import { MeetingRunner } from "@/components/meeting/MeetingRunner";
import { MeetingSummary } from "@/components/meeting/MeetingSummary";
import { Empty } from "@/components/ui";
import { fmtKoDate } from "@/lib/format";

type Item = { id: string; title: string; heldOn: string; durationMin: number | null; status: string };
const STATUS_TEXT: Record<string, string> = { draft: "기록", uploading: "업로드 중", processing: "정리 중", done: "완료", failed: "실패" };

export function ProjectMeetings({ projectId, meetings, selected, users, editable }: {
  projectId: string; meetings: Item[]; selected: MeetingDetail | null; users: UserLite[]; editable: boolean;
}) {
  const [composing, setComposing] = useState(meetings.length === 0);
  const m = selected?.meeting;
  return (
    <div className="space-y-6">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[16px] font-bold">미팅 로그</h2>
        {m && <span className="text-[12.5px] text-sub">{m.heldOn} {m.title}{m.durationMin ? ` · ${m.durationMin}분` : ""}</span>}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-dashed border-[#d6d9e3] p-5">
          {composing || !m ? (
            editable ? (
              <>
                <h3 className="mb-3 text-[15px] font-bold">녹음 파일 업로드</h3>
                <MeetingComposer projects={[]} fixedProjectId={projectId}
                  after={(id) => `/projects/${projectId}?tab=meetings&meeting=${id}`}
                  onCancel={m ? () => setComposing(false) : undefined} />
              </>
            ) : <Empty>등록된 미팅이 없습니다.</Empty>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-[15px] font-bold">처리 상태</h3>
                {editable && <button className="btn-ghost btn-sm" onClick={() => setComposing(true)}>+ 새 회의</button>}
              </div>
              <MeetingRunner m={m} editable={editable} />
              {!m.audioName && m.status === "done" && <p className="mt-2 text-[12.5px] text-sub">녹음 없이 텍스트로 등록된 회의입니다.</p>}
            </>
          )}
        </section>
        <section className="card p-5">
          {selected ? (
            <MeetingSummary m={selected.meeting} tasks={selected.tasks} users={users} editable={editable} projectId={projectId} />
          ) : <p className="text-[13px] text-sub">녹음을 올리면 Gemini가 받아 적고, 요약과 &ldquo;누가·언제까지·무엇을&rdquo; 할 일을 뽑아 이 프로젝트 태스크로 자동 등록합니다.</p>}
        </section>
      </div>

      {meetings.length > 0 && (
        <section>
          <h3 className="mb-2 text-[14px] font-bold">이 프로젝트의 회의 {meetings.length}건</h3>
          <ul className="card divide-y divide-line">
            {meetings.map((x) => (
              <li key={x.id}>
                <Link href={`/projects/${projectId}?tab=meetings&meeting=${x.id}`} scroll={false}
                  className={clsx("flex items-center gap-3 px-4 py-3 hover:bg-canvas", x.id === m?.id && "bg-brand-50/50")}>
                  <span className="w-[72px] shrink-0 text-[12.5px] text-sub">{fmtKoDate(x.heldOn)}</span>
                  <span className="flex-1 truncate text-[13.5px] font-medium">{x.title}</span>
                  {x.durationMin && <span className="text-[12px] text-faint">{x.durationMin}분</span>}
                  <span className={clsx("pill", x.status === "done" ? "bg-st-done-bg text-st-done" : x.status === "failed" ? "bg-[#fde3e7] text-pri-high" : "bg-st-prog-bg text-st-prog")}>{STATUS_TEXT[x.status] ?? x.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

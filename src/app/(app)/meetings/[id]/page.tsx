import Link from "next/link";
import { notFound } from "next/navigation";
import { canEdit, requireUser } from "@/lib/auth";
import { listUsers, meetingDetail } from "@/lib/queries";
import { MeetingRunner } from "@/components/meeting/MeetingRunner";
import { MeetingSummary } from "@/components/meeting/MeetingSummary";
import { MeetingActions } from "@/components/pages/MeetingActions";
import { fmtKoDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 녹음 구간 변환이 이 페이지에서 실행됨

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d, users] = await Promise.all([meetingDetail(id), listUsers()]);
  if (!d) notFound();
  const m = d.meeting;
  const editable = canEdit(me);
  return (
    <div className="space-y-5 px-5 py-7 lg:px-8">
      <div className="text-[12.5px] text-sub"><Link href="/meetings" className="hover:text-brand">미팅 로그</Link>{d.project && <> / <Link href={`/projects/${d.project.id}?tab=meetings&meeting=${m.id}`} className="hover:text-brand">{d.project.title}</Link></>}</div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">{m.title}</h1>
          <p className="mt-1 text-[13px] text-sub">{fmtKoDate(m.heldOn)}{m.durationMin ? ` · ${m.durationMin}분` : ""}{m.attendees ? ` · ${m.attendees}` : ""}</p>
        </div>
        {editable && <MeetingActions id={m.id} />}
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <section className="card h-fit p-5">
          <h3 className="mb-3 text-[15px] font-bold">처리 상태</h3>
          {m.steps?.length || m.audioName ? <MeetingRunner m={m} editable={editable} /> : <p className="text-[13px] text-sub">텍스트로만 기록된 회의입니다.</p>}
          {m.notes && m.transcript && (
            <details className="mt-4"><summary className="cursor-pointer text-[13px] font-semibold text-sub">회의 메모</summary>
              <p className="mt-2 whitespace-pre-wrap text-[13px]">{m.notes}</p></details>
          )}
        </section>
        <section className="card p-5">
          <MeetingSummary m={m} tasks={d.tasks} users={users} editable={editable} projectId={m.projectId} />
        </section>
      </div>
    </div>
  );
}

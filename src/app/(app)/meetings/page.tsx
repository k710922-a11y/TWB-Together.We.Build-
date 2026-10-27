import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canEdit, requireUser } from "@/lib/auth";
import { listMeetings } from "@/lib/queries";
import { NewMeetingButton } from "@/components/pages/NewMeetingButton";
import { Empty } from "@/components/ui";
import { fmtKoDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "미팅 로그" };

const STATUS_TEXT: Record<string, string> = { draft: "기록", uploading: "업로드 중", processing: "정리 중", done: "완료", failed: "실패" };

export default async function Meetings() {
  const me = await requireUser();
  const [meetings, projects] = await Promise.all([
    listMeetings(),
    db.select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.archived, false)),
  ]);
  return (
    <div className="space-y-5 px-5 py-7 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-[24px] font-bold tracking-tight">미팅 로그</h1>
        {canEdit(me) && projects.length > 0 && <NewMeetingButton projects={projects} />}
      </div>
      <p className="text-[13px] text-sub">회의 녹음이나 메모를 올리면 요약·결정 사항·할 일이 정리되고, 할 일은 프로젝트 태스크로 자동 등록됩니다.</p>
      {meetings.length === 0 ? <Empty>기록된 미팅이 없습니다.</Empty> : (
        <ul className="card divide-y divide-line">
          {meetings.map((m) => (
            <li key={m.id}>
              <Link href={`/meetings/${m.id}`} className="block px-5 py-4 hover:bg-canvas">
                <div className="flex items-center gap-3">
                  <span className="w-[72px] shrink-0 text-[12.5px] text-sub">{fmtKoDate(m.heldOn)}</span>
                  <span className="flex-1 truncate text-[14px] font-semibold">{m.title}</span>
                  <span className="hidden truncate text-[12px] text-faint sm:block">{m.projectTitle}</span>
                  <span className="pill bg-canvas text-sub">{STATUS_TEXT[m.status] ?? m.status}</span>
                </div>
                {m.summary?.[0] && <p className="mt-1 truncate pl-[84px] text-[12.5px] text-sub">· {m.summary[0]}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

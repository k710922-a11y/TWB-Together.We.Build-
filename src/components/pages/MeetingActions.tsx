"use client";

import { useRouter } from "next/navigation";
import { deleteMeeting } from "@/app/actions/meetings";
import { useAction } from "@/components/ui";

export function MeetingActions({ id }: { id: string }) {
  const { exec } = useAction();
  const router = useRouter();
  return (
    <button className="btn-danger btn-sm" onClick={() => confirm("이 미팅 기록을 삭제할까요? 자동 등록된 태스크는 남습니다.") &&
      exec(() => deleteMeeting(id), { onOk: () => router.push("/meetings") })}>삭제</button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, Trash2 } from "lucide-react";
import { deleteProject } from "@/app/actions/projects";
import { useAction } from "@/components/ui";

/** 카드 링크와 분리해 삭제 버튼이 프로젝트 이동을 일으키지 않게 한다. */
export function DeleteProjectButton({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const router = useRouter();
  const { exec, pending } = useAction();
  return (
    <button type="button" disabled={pending}
      aria-label={`${projectTitle} 프로젝트 삭제`} title="프로젝트 삭제"
      className="flex h-8 w-8 items-center justify-center rounded-lg text-sub transition-colors hover:bg-[#fff1f3] hover:text-pri-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-wait disabled:opacity-50"
      onClick={() => {
        if (pending || !window.confirm(`‘${projectTitle}’ 프로젝트와 모든 태스크·서브태스크·댓글·마일스톤을 삭제합니다. 되돌릴 수 없습니다. 계속할까요?`)) return;
        exec(() => deleteProject(projectId), {
          ok: "프로젝트를 삭제했습니다.",
          onOk: () => router.refresh(),
        });
      }}>
      {pending ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
    </button>
  );
}

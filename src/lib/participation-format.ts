/** 참여 로그 한 줄을 사람이 읽는 문장과 링크로 바꾼다 (서버·클라이언트 공용, 순수 함수) */
import { fmtKoDate } from "./format";

export const KIND_LABEL: Record<string, string> = {
  task: "태스크", comment: "댓글", board: "게시판", library: "자료실", meeting: "미팅", project: "프로젝트", access: "접속", admin: "인원 관리",
};
export const KIND_COLOR: Record<string, string> = {
  task: "#2f80ed", comment: "#5b5bf0", board: "#a25ddc", library: "#0aa5a5", meeting: "#e8891c", project: "#00b26b", access: "#9aa0b4", admin: "#e2445c",
};

type Item = { kind: string; action: string; label: string | null; detail: Record<string, unknown> | null; projectId: string | null; targetId: string | null };

const q = (s: string | null | undefined) => (s ? `“${s}”` : "");
const ROLE: Record<string, string> = { admin: "관리자", editor: "편집자", viewer: "보기" };

export function describe(it: Item): { text: string; quote?: string } {
  const d = it.detail ?? {};
  const L = q(it.label);
  switch (it.kind) {
    case "task":
      switch (it.action) {
        case "created": return { text: `${L} 태스크를 만들었습니다` };
        case "status": return { text: `${L} 상태를 ${d.from} → ${d.to}(으)로 바꿨습니다` };
        case "assignee": return { text: `${L} 담당자를 ${d.to}(으)로 지정했습니다` };
        case "due": return { text: `${L} 마감일을 ${d.to ? fmtKoDate(String(d.to)) : "없음"}(으)로 바꿨습니다` };
        case "start": return { text: `${L} 시작일을 ${d.to ? fmtKoDate(String(d.to)) : "없음"}(으)로 바꿨습니다` };
        case "priority": return { text: `${L} 우선순위를 ${d.to}(으)로 바꿨습니다` };
        case "title": return { text: `태스크 이름을 ${q(String(d.to))}(으)로 바꿨습니다` };
        case "deps": return { text: `${L}의 선행 태스크를 지정했습니다`, quote: String(d.to ?? "") };
        case "from_meeting": return { text: `미팅 ${q(String(d.meeting ?? ""))}에서 ${L} 태스크가 자동 등록됐습니다` };
        default: return { text: `${L} 태스크를 수정했습니다` };
      }
    case "comment": return { text: `${L}에 댓글을 남겼습니다`, quote: String(d.text ?? "") };
    case "board":
      if (it.action === "reply") return { text: `게시글 ${L}에 답글을 달았습니다`, quote: String(d.text ?? "") };
      return { text: it.action === "notice" ? "공지를 올렸습니다" : "게시판에 글을 올렸습니다", quote: it.label ?? "" };
    case "library":
      return { text: ({
        doc_create: `문서 ${L}을(를) 만들었습니다`, doc_save: `문서 ${L}을(를) 수정했습니다`, doc_delete: `문서 ${L}을(를) 삭제했습니다`,
        file_upload: `파일 ${L}을(를) 올렸습니다`, file_delete: `파일·링크 ${L}을(를) 삭제했습니다`, link_add: `링크 ${L}을(를) 등록했습니다`,
      } as Record<string, string>)[it.action] ?? `자료실: ${L}` };
    case "meeting":
      return { text: ({
        meeting_audio: `회의 ${L} 녹음을 올렸습니다`, meeting_create: `회의 ${L}을(를) 기록했습니다`, meeting_delete: `회의 ${L}을(를) 삭제했습니다`,
      } as Record<string, string>)[it.action] ?? `미팅: ${L}` };
    case "project":
      return { text: ({
        project_create: `프로젝트 ${L}을(를) 만들었습니다`, project_update: "프로젝트 설정을 바꿨습니다",
        project_archive: "프로젝트를 보관했습니다", project_delete: `프로젝트 ${L}을(를) 삭제했습니다`,
      } as Record<string, string>)[it.action] ?? "프로젝트 변경" };
    case "access":
      return { text: ({
        login: "로그인했습니다", visit: "접속했습니다", joined: `팀에 합류했습니다${it.label ? ` (${ROLE[it.label] ?? it.label})` : ""}`,
      } as Record<string, string>)[it.action] ?? "접속" };
    case "admin": {
      const label = it.action === "member_role" && it.label ? it.label.replace(/→ (\w+)$/, (_, r) => `→ ${ROLE[r] ?? r}`) : it.label;
      return { text: ({
        member_invite: `${label}님을 초대했습니다`, member_role: `역할 변경: ${label}`, member_deactivate: `${label}님을 해지했습니다`,
      } as Record<string, string>)[it.action] ?? "인원 관리" };
    }
    default: return { text: it.label ?? it.action };
  }
}

export function hrefOf(it: Item): string | null {
  if (it.action.endsWith("_delete")) return null;
  if ((it.kind === "task" || it.kind === "comment") && it.projectId && it.targetId) return `/projects/${it.projectId}?task=${it.targetId}`;
  if (it.kind === "library") return it.action.startsWith("doc_") && it.targetId ? `/library/docs/${it.targetId}` : "/library";
  if (it.kind === "meeting" && it.targetId) return `/meetings/${it.targetId}`;
  if (it.kind === "project" && it.projectId) return `/projects/${it.projectId}`;
  return null;
}

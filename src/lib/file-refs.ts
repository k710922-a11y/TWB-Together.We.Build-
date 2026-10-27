/** 위키 문서 본문 속 자료실 파일 참조: [이름](/files/<id>) 또는 ![이름](/files/<id>) */
const REF = /\/files\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi;

export function fileIdsIn(markdown: string): string[] {
  return [...new Set(Array.from(markdown.matchAll(REF), (m) => m[1].toLowerCase()))];
}

/** 본문에 넣을 마크다운. 이미지는 바로 보이게, 나머지는 내려받기 링크로 */
export function fileMarkdown(f: { id: string; name: string; mime?: string | null; kind?: string; url?: string | null }): string {
  const safe = f.name.replace(/[[\]]/g, "");
  if (f.kind === "link" && f.url) return `[🔗 ${safe}](${f.url})`;
  if (f.mime?.startsWith("image/")) return `![${safe}](/files/${f.id})`;
  return `[📎 ${safe}](/files/${f.id})`;
}

/** 본문에 바로 표시할 수 있는 이미지 최대 크기 (Vercel 응답 한도 4.5MB 이하) */
export const INLINE_IMAGE_MAX = 4 * 1024 * 1024;

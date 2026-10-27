import "server-only";

import { db, schema } from "./db";
import { fileIdsIn } from "./file-refs";

/** 파일 id → 그 파일을 본문에 넣은 문서 목록 */
export async function docRefsByFile(): Promise<Map<string, { id: string; title: string }[]>> {
  const docs = await db.select({ id: schema.docs.id, title: schema.docs.title, content: schema.docs.content }).from(schema.docs);
  const map = new Map<string, { id: string; title: string }[]>();
  for (const d of docs) for (const fid of fileIdsIn(d.content)) map.set(fid, [...(map.get(fid) ?? []), { id: d.id, title: d.title }]);
  return map;
}

/** 문서 본문이 참조하는 파일들 (삭제된 파일은 missing으로) */

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { CHUNK_BYTES, MAX_FILE_MB } from "@/lib/limits";
import { logActivity } from "@/lib/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 자료실 파일 업로드 (청크 방식)
 *  1) POST ?op=init  JSON {name, mime, size, projectId?, category?}  → {id}
 *  2) POST ?op=chunk&id=..&idx=N  (본문: 바이너리 최대 3MB)
 *  3) POST ?op=complete&id=..  → 청크 수 검증 후 complete=true
 */
export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const q = new URL(req.url).searchParams;
  const op = q.get("op");

  if (op === "init") {
    const body = (await req.json()) as { name: string; mime?: string; size: number; projectId?: string | null; category?: string | null };
    if (!body.name || !(body.size > 0)) return NextResponse.json({ error: "파일 정보가 올바르지 않습니다." }, { status: 400 });
    if (body.size > MAX_FILE_MB * 1024 * 1024) return NextResponse.json({ error: `파일은 최대 ${MAX_FILE_MB}MB까지 올릴 수 있습니다. 큰 파일은 드라이브 링크로 등록해 주세요.` }, { status: 413 });
    const [f] = await db.insert(schema.files).values({
      kind: "file", name: body.name.slice(0, 250), mime: body.mime || "application/octet-stream", size: body.size,
      projectId: body.projectId || null, category: body.category || null, uploadedBy: me.id, complete: false,
    }).returning({ id: schema.files.id });
    return NextResponse.json({ id: f.id });
  }

  const id = q.get("id") ?? "";
  const [f] = await db.select().from(schema.files).where(and(eq(schema.files.id, id), eq(schema.files.uploadedBy, me.id))).limit(1);
  if (!f) return NextResponse.json({ error: "업로드를 찾을 수 없습니다." }, { status: 404 });

  if (op === "chunk") {
    const idx = Number(q.get("idx"));
    const buf = Buffer.from(await req.arrayBuffer());
    if (!Number.isInteger(idx) || idx < 0 || buf.length === 0 || buf.length > CHUNK_BYTES) {
      return NextResponse.json({ error: "청크가 올바르지 않습니다." }, { status: 400 });
    }
    await db.insert(schema.fileChunks).values({ fileId: id, idx, data: buf })
      .onConflictDoUpdate({ target: [schema.fileChunks.fileId, schema.fileChunks.idx], set: { data: buf } });
    return NextResponse.json({ ok: true });
  }

  if (op === "complete") {
    const [{ n, bytes }] = await db.select({
      n: sql<number>`count(*)::int`, bytes: sql<number>`coalesce(sum(octet_length(${schema.fileChunks.data})),0)::bigint`,
    }).from(schema.fileChunks).where(eq(schema.fileChunks.fileId, id));
    const expected = Math.ceil((f.size ?? 0) / CHUNK_BYTES);
    if (n !== expected || Number(bytes) !== f.size) {
      return NextResponse.json({ error: "파일이 끝까지 전송되지 않았습니다. 다시 올려 주세요." }, { status: 400 });
    }
    await db.update(schema.files).set({ complete: true }).where(eq(schema.files.id, id));
    await logActivity(me.id, "library", "file_upload", { label: f.name, targetId: id, projectId: f.projectId });
    return NextResponse.json({ id, name: f.name });
  }
  return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
}

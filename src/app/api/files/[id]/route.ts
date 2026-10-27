import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 파일 내려받기
 *  ?meta=1     → {name, mime, size, chunks}
 *  ?chunk=N    → N번째 청크(바이너리) — 브라우저가 모아서 저장 (응답 4.5MB 한도 회피)
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { id } = await ctx.params;
  const q = new URL(req.url).searchParams;
  const [f] = await db.select().from(schema.files).where(eq(schema.files.id, id)).limit(1);
  if (!f || f.kind !== "file" || !f.complete) return NextResponse.json({ error: "파일이 없습니다." }, { status: 404 });

  if (q.has("chunk")) {
    const idx = Number(q.get("chunk"));
    const [c] = await db.select({ data: schema.fileChunks.data }).from(schema.fileChunks)
      .where(and(eq(schema.fileChunks.fileId, id), eq(schema.fileChunks.idx, idx))).limit(1);
    if (!c) return NextResponse.json({ error: "청크가 없습니다." }, { status: 404 });
    return new Response(new Uint8Array(c.data), { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "private, max-age=86400" } });
  }
  const chunks = await db.select({ idx: schema.fileChunks.idx }).from(schema.fileChunks)
    .where(eq(schema.fileChunks.fileId, id)).orderBy(asc(schema.fileChunks.idx));
  return NextResponse.json({ name: f.name, mime: f.mime, size: f.size, chunks: chunks.length });
}

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { uploadChunk } from "@/lib/gemini";
import { CHUNK_BYTES } from "@/lib/limits";
import type { MeetingStep } from "@/lib/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 녹음 청크를 받아 Gemini 재개형 업로드로 그대로 넘긴다 (녹음은 우리 DB에 저장하지 않음) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser();
  if (!me || me.role === "viewer") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const { id } = await ctx.params;
  const offset = Number(new URL(req.url).searchParams.get("offset"));
  const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id)).limit(1);
  if (!m || m.status !== "uploading" || !m.uploadUrl || !m.audioSize) {
    return NextResponse.json({ error: "업로드 중인 녹음이 없습니다." }, { status: 409 });
  }
  if (offset !== m.uploadedBytes) {
    // 이미 받은 위치를 알려 주면 브라우저가 그 지점부터 이어서 보낸다
    return NextResponse.json({ error: "offset mismatch", uploadedBytes: m.uploadedBytes }, { status: 409 });
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > CHUNK_BYTES) return NextResponse.json({ error: "청크 크기 오류" }, { status: 400 });
  const end = offset + bytes.byteLength;
  const final = end >= m.audioSize;
  try {
    const file = await uploadChunk(m.uploadUrl, offset, bytes, final);
    if (final) {
      if (!file) throw new Error("Gemini가 파일 정보를 돌려주지 않았습니다.");
      const steps: MeetingStep[] = (m.steps ?? []).map((s) => ({ ...s }));
      await db.update(schema.meetings).set({
        uploadedBytes: end, uploadUrl: null, geminiFileName: file.name, geminiFileUri: file.uri,
        audioMime: file.mimeType || m.audioMime, status: "processing", steps,
      }).where(eq(schema.meetings.id, id));
    } else {
      await db.update(schema.meetings).set({ uploadedBytes: end }).where(eq(schema.meetings.id, id));
    }
    return NextResponse.json({ uploadedBytes: end, done: final });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(schema.meetings).set({ status: "failed", error: `녹음 업로드 실패: ${msg}` }).where(eq(schema.meetings.id, id));
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

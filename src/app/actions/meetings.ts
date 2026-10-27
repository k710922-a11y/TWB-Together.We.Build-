"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, lt, max, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import type { MeetingStep } from "@/lib/schema";
import { assertRole } from "@/lib/auth";
import { run, UserError } from "@/lib/result";
import { analyzeMeeting, deleteFile, geminiReady, getFile, startUpload, transcribeSegment } from "@/lib/gemini";
import { MAX_AUDIO_MB, SEGMENT_MIN } from "@/lib/limits";
import { logActivity } from "@/lib/audit";

const refresh = () => revalidatePath("/", "layout");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type AudioMeta = { name: string; mime: string; size: number };

export type MeetingInput = {
  projectId: string;
  title: string;
  heldOn: string;
  durationMin?: number | null;
  attendees?: string;
  notes?: string;
  audio?: AudioMeta | null;
};

const AUDIO_EXT_MIME: Record<string, string> = {
  m4a: "audio/m4a", mp3: "audio/mp3", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg",
  flac: "audio/flac", webm: "audio/webm", opus: "audio/opus", mp4: "audio/mp4", aiff: "audio/aiff",
};
function audioMime(a: AudioMeta) {
  const ext = a.name.split(".").pop()?.toLowerCase() ?? "";
  return AUDIO_EXT_MIME[ext] ?? (a.mime?.startsWith("audio/") ? a.mime : "audio/mpeg");
}

async function beginAudio(meetingId: string, audio: AudioMeta) {
  if (audio.size <= 0) throw new UserError("빈 파일입니다.");
  if (audio.size > MAX_AUDIO_MB * 1024 * 1024) throw new UserError(`녹음 파일은 최대 ${MAX_AUDIO_MB}MB까지 가능합니다.`);
  if (!geminiReady()) throw new UserError("GEMINI_API_KEY가 설정되지 않아 녹음을 처리할 수 없습니다. 관리자에게 문의하세요.");
  const mime = audioMime(audio);
  const uploadUrl = await startUpload(audio.size, mime, audio.name);
  await db.update(schema.meetings).set({
    audioName: audio.name, audioMime: mime, audioSize: audio.size, uploadUrl, uploadedBytes: 0,
    geminiFileName: null, geminiFileUri: null, transcript: null, transcriptParts: [],
    status: "uploading", error: null, steps: initialSteps(true),
  }).where(eq(schema.meetings.id, meetingId));
}

function initialSteps(hasAudio: boolean): MeetingStep[] {
  return [
    ...(hasAudio ? [{ key: "stt", label: "음성 → 텍스트 변환", state: "pending" as const }] : []),
    { key: "summary", label: "요약 생성 (Gemini)", state: "pending" },
    { key: "actions", label: "액션 아이템 추출", state: "pending" },
    { key: "register", label: "할 일 태스크 자동 등록", state: "pending" },
  ];
}

export async function createMeeting(input: MeetingInput) {
  return run(async () => {
    const me = await assertRole("editor");
    if (!input.projectId) throw new UserError("프로젝트를 선택해 주세요.");
    if (!input.title.trim()) throw new UserError("회의 제목을 입력해 주세요.");
    if (!DATE_RE.test(input.heldOn)) throw new UserError("회의 날짜를 입력해 주세요.");
    if (input.audio && !geminiReady()) throw new UserError("GEMINI_API_KEY가 설정되지 않아 녹음을 처리할 수 없습니다. 녹음 없이 회의록만 등록하거나 관리자에게 문의하세요.");
    const notes = input.notes?.trim() || null;
    const [m] = await db.insert(schema.meetings).values({
      projectId: input.projectId,
      title: input.title.trim(),
      heldOn: input.heldOn,
      durationMin: input.durationMin ?? null,
      attendees: input.attendees?.trim() || null,
      notes,
      createdBy: me.id,
      status: "draft",
    }).returning();
    await logActivity(me.id, "meeting", input.audio ? "meeting_audio" : "meeting_create", { label: m.title, targetId: m.id, projectId: m.projectId });
    if (input.audio) {
      await beginAudio(m.id, input.audio);
    } else if (notes && geminiReady()) {
      await db.update(schema.meetings).set({ status: "processing", steps: initialSteps(false) }).where(eq(schema.meetings.id, m.id));
    } else {
      await db.update(schema.meetings).set({ status: "done" }).where(eq(schema.meetings.id, m.id));
    }
    refresh();
    return { id: m.id, upload: Boolean(input.audio) };
  });
}

/** 녹음을 (다시) 올리기 — 업로드가 끊겼거나 Gemini 파일이 만료된 경우 */
export async function restartAudio(meetingId: string, audio: AudioMeta, durationMin: number | null) {
  return run(async () => {
    await assertRole("editor");
    if (durationMin) await db.update(schema.meetings).set({ durationMin }).where(eq(schema.meetings.id, meetingId));
    await beginAudio(meetingId, audio);
    refresh();
    return null;
  });
}

export async function retryMeeting(id: string) {
  return run(async () => {
    await assertRole("editor");
    const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id)).limit(1);
    if (!m) throw new UserError("미팅을 찾을 수 없습니다.");
    if (m.audioSize && !m.geminiFileName && !m.transcript) throw new UserError("녹음 업로드가 끝나지 않았습니다. 녹음 파일을 다시 올려 주세요.");
    if (!m.audioSize && !m.notes) throw new UserError("녹음 파일이나 회의록 텍스트가 없습니다.");
    const steps = (m.steps ?? initialSteps(Boolean(m.audioSize))).map((s) => (s.state === "failed" ? { ...s, state: "pending" as const } : s));
    await db.update(schema.meetings).set({ status: "processing", error: null, steps, lockedUntil: null }).where(eq(schema.meetings.id, id));
    refresh();
    return null;
  });
}

/** 회의록 메모를 고친 뒤 요약·액션 아이템만 다시 뽑기 */
export async function reanalyzeMeeting(id: string) {
  return run(async () => {
    await assertRole("editor");
    const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id)).limit(1);
    if (!m) throw new UserError("미팅을 찾을 수 없습니다.");
    if (!m.notes && !m.transcript) throw new UserError("분석할 회의록 텍스트가 없습니다.");
    if (!geminiReady()) throw new UserError("GEMINI_API_KEY가 설정되지 않았습니다.");
    const steps = initialSteps(Boolean(m.transcript)).map((s) => (s.key === "stt" ? { ...s, state: "done" as const } : s));
    await db.update(schema.meetings).set({ status: "processing", error: null, steps, lockedUntil: null }).where(eq(schema.meetings.id, id));
    refresh();
    return null;
  });
}

export async function updateMeetingText(id: string, patch: { title?: string; notes?: string; summary?: string[]; decisions?: string[]; attendees?: string }) {
  return run(async () => {
    await assertRole("editor");
    const set: Partial<typeof schema.meetings.$inferInsert> = {};
    if (patch.title !== undefined) set.title = patch.title.trim() || "제목 없는 회의";
    if (patch.notes !== undefined) set.notes = patch.notes;
    if (patch.attendees !== undefined) set.attendees = patch.attendees;
    if (patch.summary !== undefined) set.summary = patch.summary.map((s) => s.trim()).filter(Boolean);
    if (patch.decisions !== undefined) set.decisions = patch.decisions.map((s) => s.trim()).filter(Boolean);
    await db.update(schema.meetings).set(set).where(eq(schema.meetings.id, id));
    refresh();
    return null;
  });
}

export async function deleteMeeting(id: string) {
  return run(async () => {
    const me = await assertRole("editor");
    const [m] = await db.select().from(schema.meetings).where(eq(schema.meetings.id, id)).limit(1);
    if (!m) return null;
    await db.delete(schema.meetings).where(eq(schema.meetings.id, id));
    await logActivity(me.id, "meeting", "meeting_delete", { label: m.title, projectId: m.projectId });
    if (m.geminiFileName) await deleteFile(m.geminiFileName);
    refresh();
    return null; // 자동 등록된 태스크는 남긴다
  });
}

/* ── 단계별 처리 ──────────────────────────────────────────
 * Vercel 함수는 실행 시간이 제한(최대 300초)되므로, 화면이 이 액션을 반복 호출해
 * 한 번에 한 단계(또는 녹음 15분 구간 하나)씩 진행한다. 탭을 닫아도 진행 상황은 DB에 남고,
 * 누구든 미팅을 다시 열면 이어서 처리된다.
 */
export type AdvanceResult = { status: string; wait?: number };

export async function advanceMeeting(id: string) {
  return run<AdvanceResult>(async () => {
    const me = await assertRole("viewer"); // 화면을 열어 둔 누구든 진행을 이어갈 수 있음
    // 동시 처리 방지 잠금 (290초)
    const lock = await db.update(schema.meetings)
      .set({ lockedUntil: new Date(Date.now() + 290_000) })
      .where(and(eq(schema.meetings.id, id), eq(schema.meetings.status, "processing"),
        or(isNull(schema.meetings.lockedUntil), lt(schema.meetings.lockedUntil, new Date()))))
      .returning();
    const m = lock[0];
    if (!m) {
      const [cur] = await db.select({ status: schema.meetings.status }).from(schema.meetings).where(eq(schema.meetings.id, id));
      return { status: cur?.status ?? "missing", wait: cur?.status === "processing" ? 5000 : undefined };
    }

    const steps: MeetingStep[] = (m.steps ?? initialSteps(Boolean(m.audioSize))).map((s) => ({ ...s }));
    const step = steps.find((s) => s.state !== "done");
    const save = (extra: Partial<typeof schema.meetings.$inferInsert> = {}) =>
      db.update(schema.meetings).set({ steps, lockedUntil: null, ...extra }).where(eq(schema.meetings.id, id));
    const mark = (key: string, state: MeetingStep["state"], label?: string) => {
      const s = steps.find((x) => x.key === key);
      if (s) { s.state = state; if (label) s.label = label; }
    };

    try {
      if (!step) {
        if (m.geminiFileName) await deleteFile(m.geminiFileName);
        await save({ status: "done", geminiFileName: null, geminiFileUri: null });
        return { status: "done" };
      }
      if (!geminiReady()) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다. Vercel 환경 변수에 키를 넣고 다시 시도해 주세요.");

      if (step.key === "stt") {
        if (!m.geminiFileName) throw new Error("녹음 업로드가 끝나지 않았습니다. 녹음 파일을 다시 올려 주세요.");
        const file = await getFile(m.geminiFileName).catch(() => {
          throw new Error("Gemini에 올린 녹음을 찾을 수 없습니다(48시간 보관). 녹음 파일을 다시 올려 주세요.");
        });
        if (file.state === "PROCESSING") { mark("stt", "running", "음성 → 텍스트 변환 (파일 준비 중)"); await save(); return { status: "processing", wait: 5000 }; }
        if (file.state === "FAILED") throw new Error("Gemini가 이 오디오 형식을 처리하지 못했습니다. mp3/m4a/wav로 변환해 다시 올려 주세요.");
        const total = m.durationMin ? Math.max(1, Math.ceil(m.durationMin / SEGMENT_MIN)) : 1;
        const parts = [...(m.transcriptParts ?? [])];
        const k = parts.length;
        const from = total > 1 ? k * SEGMENT_MIN * 60 : null;
        const to = total > 1 ? Math.min((k + 1) * SEGMENT_MIN * 60, (m.durationMin ?? 0) * 60 + 59) : null;
        parts.push(await transcribeSegment(file, from, to));
        if (parts.length >= total) {
          mark("stt", "done", "음성 → 텍스트 변환");
          await save({ transcriptParts: parts, transcript: parts.filter(Boolean).join("\n") });
        } else {
          mark("stt", "running", `음성 → 텍스트 변환 (${parts.length}/${total})`);
          await save({ transcriptParts: parts });
        }
        return { status: "processing" };
      }

      if (step.key === "summary" || step.key === "actions") {
        mark("summary", "running");
        const members = await db.select({ name: schema.users.name }).from(schema.users).where(eq(schema.users.active, true));
        const source = [m.notes ? `[메모]\n${m.notes}` : "", m.transcript ? `[녹취]\n${m.transcript}` : ""].filter(Boolean).join("\n\n");
        const result = await analyzeMeeting(source, { heldOn: m.heldOn, members: members.map((u) => u.name) });
        mark("summary", "done");
        mark("actions", "done", `액션 아이템 추출 (${result.actionItems.length}건)`);
        await save({ summary: result.summary, decisions: result.decisions, pendingActions: result.actionItems });
        return { status: "processing" };
      }

      if (step.key === "register") {
        let created = 0;
        const items = m.pendingActions ?? [];
        if (m.projectId && items.length) {
          const members = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users).where(eq(schema.users.active, true));
          const existing = await db.select({ title: schema.tasks.title }).from(schema.tasks).where(eq(schema.tasks.meetingId, id));
          const seen = new Set(existing.map((e) => e.title));
          const [{ mo }] = await db.select({ mo: max(schema.tasks.sortOrder) }).from(schema.tasks).where(eq(schema.tasks.projectId, m.projectId));
          let order = (mo ?? 0) + 1;
          for (const a of items) {
            if (seen.has(a.title)) continue;
            const who = a.assignee ? members.find((u) => u.name === a.assignee || a.assignee!.includes(u.name)) : undefined;
            const [t] = await db.insert(schema.tasks).values({
              projectId: m.projectId, title: a.title, assigneeId: who?.id ?? null, dueDate: a.dueDate,
              source: "meeting", meetingId: id, createdBy: m.createdBy ?? me.id, sortOrder: order++,
            }).returning({ id: schema.tasks.id });
            await db.insert(schema.taskActivity).values({ taskId: t.id, userId: m.createdBy ?? me.id, action: "from_meeting", detail: { meeting: m.title } });
            created++;
          }
        }
        mark("register", "done", `할 일 태스크 자동 등록 (${created}건)`);
        if (m.geminiFileName) await deleteFile(m.geminiFileName); // 구글 서버에 녹음을 남기지 않음
        await save({ status: "done", pendingActions: null, geminiFileName: null, geminiFileUri: null });
        return { status: "done" };
      }
      return { status: m.status };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[twb] meeting step failed", id, e);
      if (step) mark(step.key, "failed");
      await save({ status: "failed", error: msg });
      return { status: "failed" };
    }
  });
}

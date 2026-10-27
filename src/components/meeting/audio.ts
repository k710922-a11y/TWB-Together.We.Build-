"use client";

import { CHUNK_BYTES } from "@/lib/limits";

/** 오디오 길이(분)를 브라우저에서 측정 — 15분 구간 나눔에 사용 */
export function measureDurationMin(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (v: number | null) => { URL.revokeObjectURL(url); resolve(v); };
    a.preload = "metadata";
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) && a.duration > 0 ? Math.ceil(a.duration / 60) : null);
    a.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    a.src = url;
  });
}

/** 녹음을 3MB씩 서버로 보내 Gemini로 중계. 끊기면 서버가 알려 준 위치부터 이어서 보낸다. */
export async function uploadAudio(meetingId: string, file: File, onProgress: (p: number) => void) {
  let offset = 0;
  let retries = 0;
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_BYTES);
    let res: Response;
    try {
      res = await fetch(`/api/meetings/${meetingId}/audio?offset=${offset}`, { method: "POST", body: chunk });
    } catch {
      if (++retries > 4) throw new Error("네트워크가 불안정해 업로드를 멈췄습니다. 다시 시도해 주세요.");
      await new Promise((r) => setTimeout(r, 1500 * retries));
      continue;
    }
    const j = await res.json().catch(() => ({}));
    if (res.status === 409 && typeof j.uploadedBytes === "number") { offset = j.uploadedBytes; continue; }
    if (!res.ok) throw new Error(j.error ?? `업로드 실패(${res.status})`);
    offset = j.uploadedBytes;
    retries = 0;
    onProgress(Math.min(1, offset / file.size));
  }
}

export const AUDIO_ACCEPT = ".m4a,.mp3,.wav,.aac,.ogg,.flac,.webm,.opus,.mp4,audio/*";

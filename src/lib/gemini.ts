import "server-only";

const BASE = "https://generativelanguage.googleapis.com";
const key = () => process.env.GEMINI_API_KEY ?? "";
export const geminiModel = () => process.env.GEMINI_MODEL || "gemini-flash-latest";
/** 개발·테스트용: GEMINI_MOCK=1 이면 외부 호출 없이 가짜 결과를 돌려준다 */
const mock = () => process.env.GEMINI_MOCK === "1";
export const geminiReady = () => mock() || key().length > 0;

async function api(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, headers: { "x-goog-api-key": key(), ...(init.headers ?? {}) } });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try { msg = JSON.parse(body)?.error?.message ?? body; } catch { /* 원문 사용 */ }
    if (res.status === 429) throw new Error("Gemini 무료 사용량 한도에 걸렸습니다. 1~2분 뒤 '이어서 처리'를 눌러 주세요.");
    if (res.status === 404) throw new Error(`Gemini 모델 또는 파일을 찾을 수 없습니다. GEMINI_MODEL(${geminiModel()}) 값을 확인하세요.`);
    if (res.status === 400 || res.status === 403) throw new Error(`Gemini 요청 거부(${res.status}): ${msg.slice(0, 300)}`);
    throw new Error(`Gemini 오류(${res.status}): ${msg.slice(0, 300)}`);
  }
  return res;
}

export type RemoteFile = { name: string; uri: string; mimeType: string; state?: string };

/* ── 업로드: 브라우저 → (3MB 청크) → 우리 서버 → Gemini 재개형 업로드 ─────────── */

export async function startUpload(size: number, mime: string, displayName: string): Promise<string> {
  if (mock()) return "mock://upload";
  const res = await api(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(size),
      "X-Goog-Upload-Header-Content-Type": mime,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName.slice(0, 120) } }),
  });
  const url = res.headers.get("x-goog-upload-url");
  if (!url) throw new Error("Gemini 업로드 주소를 받지 못했습니다.");
  return url;
}

/** 청크 전송. 마지막 청크면 finalize 후 파일 정보를 돌려준다. */
export async function uploadChunk(uploadUrl: string, offset: number, bytes: Uint8Array, final: boolean): Promise<RemoteFile | null> {
  if (mock()) {
    return final ? { name: "files/mock", uri: "mock://file", mimeType: "audio/mp3", state: "ACTIVE" } : null;
  }
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": String(offset),
      "X-Goog-Upload-Command": final ? "upload, finalize" : "upload",
    },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`녹음 전송 실패(${res.status}): ${t.slice(0, 200)}`);
  }
  if (!final) return null;
  const info = (await res.json()) as { file: RemoteFile };
  return info.file;
}

export async function getFile(name: string): Promise<RemoteFile> {
  if (mock()) return { name, uri: "mock://file", mimeType: "audio/mp3", state: "ACTIVE" };
  return (await (await api(`${BASE}/v1beta/${name}`, { method: "GET" })).json()) as RemoteFile;
}

export async function deleteFile(name: string) {
  if (mock() || !name) return;
  await fetch(`${BASE}/v1beta/${name}`, { method: "DELETE", headers: { "x-goog-api-key": key() } }).catch(() => undefined);
}

async function generate(parts: unknown[], json?: object): Promise<string> {
  const res = await api(`${BASE}/v1beta/models/${geminiModel()}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 32768,
        ...(json ? { responseMimeType: "application/json", responseSchema: json } : {}),
      },
    }),
  });
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[];
    promptFeedback?: { blockReason?: string };
  };
  if (data.promptFeedback?.blockReason) throw new Error(`Gemini가 요청을 차단했습니다(${data.promptFeedback.blockReason}).`);
  const text = data.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
  return text;
}

const ts = (sec: number) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = Math.floor(sec % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};

/** 녹음의 한 구간(fromSec~toSec)을 받아 적는다. 길이를 모르면 전체를 한 번에. */
export async function transcribeSegment(file: RemoteFile, fromSec: number | null, toSec: number | null): Promise<string> {
  if (mock()) {
    await new Promise((r) => setTimeout(r, 800));
    return `[모의 변환 ${fromSec ?? 0}s~] 민수: 칸반 상태 반영은 이번 주 안에 마무리하겠습니다.\n지우: 배포는 다음 주로 미루고 베타 일정은 유지하죠.\n서연: 댓글 이력 UI는 상세 패널에서만 보이게 와이어프레임 올리겠습니다.`;
  }
  const range = fromSec !== null && toSec !== null
    ? `녹음의 ${ts(fromSec)}부터 ${ts(toSec)}까지 구간만 받아 적어 주세요. 구간 밖 내용은 적지 마세요. `
    : "녹음 전체를 받아 적어 주세요. ";
  const text = await generate([
    { file_data: { mime_type: file.mimeType, file_uri: file.uri } },
    {
      text:
        "이 회의 녹음을 한국어로 받아 적어 주세요. " + range +
        "화자가 바뀔 때마다 줄을 바꾸고, 이름이 언급되면 '이름:' 형태로, 모르면 '화자1:', '화자2:'로 표시하세요. " +
        "군말(음, 어)은 빼고 요약하지 말고 그대로 적어 주세요. 말소리가 없는 구간이면 빈 문자열만 출력하세요. 받아 적은 본문만 출력하세요.",
    },
  ]);
  return text.trim();
}

export type MeetingAnalysis = {
  summary: string[];
  decisions: string[];
  actionItems: { title: string; assignee: string | null; dueDate: string | null }[];
};

/** 회의록 텍스트 → 요약·결정 사항·액션 아이템 */
export async function analyzeMeeting(text: string, opts: { heldOn: string; members: string[] }): Promise<MeetingAnalysis> {
  if (mock()) {
    await new Promise((r) => setTimeout(r, 600));
    const m = opts.members;
    return {
      summary: ["칸반 상태 반영은 이번 주 안에 마무리하고 배포는 다음 주로 미룸", "댓글 이력은 태스크 상세에서만 보이도록 결정"],
      decisions: ["베타 일정은 유지, 배포만 1주 연기"],
      actionItems: [
        { title: "칸반 상태 반영 테스트 작성", assignee: m[1] ?? m[0] ?? null, dueDate: null },
        { title: "배포 일정 다음 주로 조정", assignee: m[0] ?? null, dueDate: null },
      ],
    };
  }
  const schemaDef = {
    type: "OBJECT",
    properties: {
      summary: { type: "ARRAY", items: { type: "STRING" } },
      decisions: { type: "ARRAY", items: { type: "STRING" } },
      actionItems: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            title: { type: "STRING" },
            assignee: { type: "STRING", nullable: true },
            dueDate: { type: "STRING", nullable: true },
          },
          required: ["title"],
        },
      },
    },
    required: ["summary", "decisions", "actionItems"],
  };
  const prompt = [
    `다음은 ${opts.heldOn}에 열린 팀 회의 기록입니다. 한국어로 정리해 주세요.`,
    `- summary: 핵심 논의를 3~6개의 짧은 문장으로 (각 60자 이내)`,
    `- decisions: 확정된 결정 사항만 (없으면 빈 배열)`,
    `- actionItems: "누가, 언제까지, 무엇을" 해야 하는 일. title은 짧은 할 일 문장.`,
    `  assignee는 반드시 다음 팀원 이름 중 하나 또는 null: ${opts.members.join(", ") || "(팀원 없음)"}`,
    `  dueDate는 YYYY-MM-DD. "다음 주", "금요일까지" 같은 표현은 회의일(${opts.heldOn}) 기준으로 계산하고, 언급이 없으면 null.`,
    "",
    "회의 기록:",
    text.slice(0, 400_000),
  ].join("\n");
  const raw = await generate([{ text: prompt }], schemaDef);
  let parsed: MeetingAnalysis;
  try {
    parsed = JSON.parse(raw) as MeetingAnalysis;
  } catch {
    throw new Error("Gemini 응답을 해석하지 못했습니다. '이어서 처리'로 다시 시도해 주세요.");
  }
  const okDate = (d: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  return {
    summary: (parsed.summary ?? []).filter(Boolean),
    decisions: (parsed.decisions ?? []).filter(Boolean),
    actionItems: (parsed.actionItems ?? []).filter((a) => a?.title).map((a) => ({
      title: a.title.trim(), assignee: a.assignee?.trim() || null, dueDate: okDate(a.dueDate),
    })),
  };
}

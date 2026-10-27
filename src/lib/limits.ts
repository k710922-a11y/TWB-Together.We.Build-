/** 클라이언트·서버 공용 상수 */
// 3MiB — Vercel 함수 본문 한도(4.5MB) 이하이면서 Gemini 업로드 단위(256KiB)의 배수
export const CHUNK_BYTES = 3 * 1024 * 1024;
export const MAX_FILE_MB = 50; // 자료실 파일 1개 최대 크기 (Supabase 무료 DB 500MB 공유)
export const MAX_AUDIO_MB = 2000; // Gemini Files API 한도 2GB
export const SEGMENT_MIN = 15; // 녹음 텍스트 변환 단위(분) — 함수 실행 시간 한도 안에 끝나도록
export const MAX_MEMBERS_DEFAULT = 10;

export type Result<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string; conflict?: boolean };

export class UserError extends Error {}

/** 서버 액션 래퍼: 운영 모드에서도 에러 메시지가 사용자에게 그대로 전달되도록 결과 객체로 변환 */
export async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    // redirect()/notFound() 같은 Next 제어 흐름 예외는 그대로 다시 던짐
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
    const msg = e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다.";
    if (!(e instanceof UserError)) console.error("[twb] action error", e);
    return { ok: false, error: msg };
  }
}

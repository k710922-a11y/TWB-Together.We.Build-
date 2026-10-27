/**
 * 서버(함수 인스턴스) 기동 시 1회: Supabase 풀러 주소 확인.
 * Supabase 프로젝트마다 풀러 클러스터가 aws-0 / aws-1 로 다를 수 있어,
 * 설정된 주소가 "tenant/user not found"로 거부되면 다른 클러스터 주소로 자동 전환한다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const url = process.env.DATABASE_URL;
  if (!url || !/pooler\.supabase\.com/.test(url)) return;
  const postgres = (await import("postgres")).default;
  const alt = url.includes("aws-0-") ? url.replace("aws-0-", "aws-1-") : url.includes("aws-1-") ? url.replace("aws-1-", "aws-0-") : null;
  for (const candidate of [url, alt].filter(Boolean) as string[]) {
    const sql = postgres(candidate, { max: 1, prepare: false, connect_timeout: 8 });
    try {
      await sql`select 1`;
      if (candidate !== url) {
        process.env.DATABASE_URL = candidate;
        console.warn("[twb] DATABASE_URL 풀러 주소를 자동 전환했습니다:", candidate.replace(/:[^:@/]+@/, ":***@").replace(/^.*@/, ""));
      }
      return;
    } catch (e) {
      console.error("[twb] DB 연결 확인 실패:", (e as Error).message);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => undefined);
    }
  }
}

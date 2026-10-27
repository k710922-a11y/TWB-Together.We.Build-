/**
 * 서버(함수 인스턴스) 기동 시 1회: Supabase 풀러 주소 확인.
 * 프로젝트마다 풀러 클러스터가 aws-0 / aws-1 로 다를 수 있어, 설정된 주소가 거부되면 다른 클러스터로 전환한다.
 * 일시적인 네트워크 실패로 잘못된 주소에 머무르지 않도록 몇 차례 재시도한다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const url = process.env.DATABASE_URL;
  if (!url || !/pooler\.supabase\.com/.test(url)) return;
  const postgres = (await import("postgres")).default;
  const alt = url.includes("aws-0-") ? url.replace("aws-0-", "aws-1-") : url.includes("aws-1-") ? url.replace("aws-1-", "aws-0-") : null;
  const candidates = [url, alt].filter(Boolean) as string[];
  const host = (u: string) => u.replace(/^.*@/, "").replace(/\/.*$/, "");

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const candidate of candidates) {
      const sql = postgres(candidate, { max: 1, prepare: false, connect_timeout: 6 });
      try {
        await sql`select 1`;
        if (candidate !== url) {
          process.env.DATABASE_URL = candidate;
          console.warn(`[twb] DATABASE_URL 풀러 주소를 ${host(candidate)}(으)로 자동 전환했습니다. Vercel 환경 변수도 이 주소로 바꿔 주세요.`);
        }
        return;
      } catch (e) {
        console.error(`[twb] DB 연결 확인 실패 (${host(candidate)}, ${attempt + 1}회차):`, (e as Error).message);
      } finally {
        await sql.end({ timeout: 2 }).catch(() => undefined);
      }
    }
    await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
  }
}

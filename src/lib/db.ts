import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Supabase 트랜잭션 풀러(포트 6543) 사용 — 풀러가 prepared statement를 지원하지 않으므로 prepare:false.
 * 한 커넥션에 여러 쿼리를 겹쳐 보내면(파이프라이닝) 풀러에서 멈추는 문제가 있어,
 * 화면 하나가 동시에 날리는 쿼리 수(최대 8개 안팎)보다 넉넉하게 커넥션을 허용한다.
 */
const url = process.env.DATABASE_URL ?? "postgres://twb:twb@localhost:5432/twb";

const g = globalThis as unknown as { __twbSql?: ReturnType<typeof postgres> };
export const sql = g.__twbSql ?? postgres(url, { max: 12, prepare: false, idle_timeout: 20, connect_timeout: 15 });
g.__twbSql = sql;

export const db = drizzle(sql, { schema });
export { schema };

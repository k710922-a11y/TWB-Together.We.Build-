import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

/**
 * Supabase 트랜잭션 풀러(포트 6543) 사용 — 서버리스(Vercel)에서는 인스턴스마다 커넥션 1개,
 * 풀러가 prepared statement를 지원하지 않으므로 prepare:false.
 */
const url = process.env.DATABASE_URL ?? "postgres://twb:twb@localhost:5432/twb";

const g = globalThis as unknown as { __twbSql?: ReturnType<typeof postgres> };
export const sql = g.__twbSql ?? postgres(url, { max: 1, prepare: false, idle_timeout: 20, connect_timeout: 15 });
g.__twbSql = sql;

export const db = drizzle(sql, { schema });
export { schema };

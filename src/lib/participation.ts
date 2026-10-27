import "server-only";
import { sql, type SQL } from "drizzle-orm";
import { db } from "./db";

/** 모든 참여 기록을 한 줄 형식으로 모은 피드 (기존 테이블 + activity_log) */
const FEED = sql`
  select ta.user_id, 'task'::text as kind, ta.action, t.title as label, ta.detail, t.project_id, t.id as target_id, ta.created_at
    from task_activity ta join tasks t on t.id = ta.task_id
  union all
  select c.user_id, 'comment', 'comment', t.title, jsonb_build_object('text', left(c.content, 160)), t.project_id, t.id, c.created_at
    from comments c join tasks t on t.id = c.task_id
  union all
  select p.user_id, 'board', case when p.is_notice then 'notice' else 'post' end, left(p.content, 120), null, null, p.id, p.created_at
    from posts p
  union all
  select r.user_id, 'board', 'reply', left(p.content, 60), jsonb_build_object('text', left(r.content, 160)), null, p.id, r.created_at
    from post_replies r join posts p on p.id = r.post_id
  union all
  select a.user_id, a.kind, a.action, a.label, null, a.project_id, a.target_id, a.created_at
    from activity_log a`;

export const FEED_KINDS = ["task", "comment", "board", "library", "meeting", "project", "access", "admin"] as const;
export type FeedKind = (typeof FEED_KINDS)[number];

export type FeedItem = {
  kind: FeedKind; action: string; label: string | null; detail: Record<string, unknown> | null;
  projectId: string | null; projectTitle: string | null; targetId: string | null; createdAt: string;
};

export async function participationFeed(userId: string, opts: { days: number | null; kind: FeedKind | null; limit: number }) {
  const conds: SQL[] = [sql`f.user_id = ${userId}`];
  if (opts.days) conds.push(sql`f.created_at > now() - make_interval(days => ${opts.days})`);
  if (opts.kind) conds.push(sql`f.kind = ${opts.kind}`);
  const rows = await db.execute<{
    kind: FeedKind; action: string; label: string | null; detail: Record<string, unknown> | null;
    project_id: string | null; project_title: string | null; target_id: string | null; created_at: Date | string;
  }>(sql`
    with feed as (${FEED})
    select f.kind, f.action, f.label, f.detail, f.project_id, pr.title as project_title, f.target_id, f.created_at
      from feed f left join projects pr on pr.id = f.project_id
     where ${sql.join(conds, sql` and `)}
     order by f.created_at desc
     limit ${opts.limit + 1}`);
  const items: FeedItem[] = rows.slice(0, opts.limit).map((r) => ({
    kind: r.kind, action: r.action, label: r.label, detail: r.detail, projectId: r.project_id, projectTitle: r.project_title,
    targetId: r.target_id, createdAt: new Date(r.created_at).toISOString(),
  }));
  return { items, hasMore: rows.length > opts.limit };
}

export type MemberStats = {
  userId: string; active7: number; active30: number; activeDays30: number;
  lastAccess: string | null; lastAction: string | null;
  daily: number[]; // 최근 14일 (오래된 날 → 오늘), 접속 제외 활동 수
  openTasks: number; completed30: number;
  kinds30: Partial<Record<FeedKind, number>>;
};

/** 팀원별 요약 (접속 기록은 '활동' 수에서 제외하고 마지막 접속 시각에만 사용) */
export async function participationSummary(): Promise<Map<string, MemberStats>> {
  const [base, daily, kinds, completed, open] = await Promise.all([
    db.execute<{ user_id: string; a7: number; a30: number; days30: number; last_access: Date | null; last_action: Date | null }>(sql`
      with feed as (${FEED})
      select user_id,
        count(*) filter (where kind <> 'access' and created_at > now() - interval '7 days')::int as a7,
        count(*) filter (where kind <> 'access' and created_at > now() - interval '30 days')::int as a30,
        count(distinct (created_at at time zone 'Asia/Seoul')::date) filter (where created_at > now() - interval '30 days')::int as days30,
        max(created_at) filter (where kind = 'access') as last_access,
        max(created_at) filter (where kind <> 'access') as last_action
      from feed where user_id is not null group by user_id`),
    db.execute<{ user_id: string; ago: number; n: number }>(sql`
      with feed as (${FEED})
      select user_id, ((now() at time zone 'Asia/Seoul')::date - (created_at at time zone 'Asia/Seoul')::date)::int as ago, count(*)::int as n
      from feed where kind <> 'access' and user_id is not null and created_at > now() - interval '15 days'
      group by 1, 2`),
    db.execute<{ user_id: string; kind: FeedKind; n: number }>(sql`
      with feed as (${FEED})
      select user_id, kind, count(*)::int as n from feed
      where user_id is not null and created_at > now() - interval '30 days' group by 1, 2`),
    db.execute<{ user_id: string; n: number }>(sql`
      select user_id, count(distinct task_id)::int as n from task_activity
      where action = 'status' and detail->>'to' = '완료' and created_at > now() - interval '30 days' and user_id is not null
      group by 1`),
    db.execute<{ user_id: string; n: number }>(sql`
      select assignee_id as user_id, count(*)::int as n from tasks where status <> 'done' and assignee_id is not null group by 1`),
  ]);

  const map = new Map<string, MemberStats>();
  const get = (id: string) => {
    let s = map.get(id);
    if (!s) {
      s = { userId: id, active7: 0, active30: 0, activeDays30: 0, lastAccess: null, lastAction: null, daily: Array(14).fill(0), openTasks: 0, completed30: 0, kinds30: {} };
      map.set(id, s);
    }
    return s;
  };
  for (const r of base) {
    const s = get(r.user_id);
    s.active7 = r.a7; s.active30 = r.a30; s.activeDays30 = r.days30;
    s.lastAccess = r.last_access ? new Date(r.last_access).toISOString() : null;
    s.lastAction = r.last_action ? new Date(r.last_action).toISOString() : null;
  }
  for (const r of daily) if (r.ago >= 0 && r.ago < 14) get(r.user_id).daily[13 - r.ago] = r.n;
  for (const r of kinds) get(r.user_id).kinds30[r.kind] = r.n;
  for (const r of completed) get(r.user_id).completed30 = r.n;
  for (const r of open) get(r.user_id).openTasks = r.n;
  return map;
}

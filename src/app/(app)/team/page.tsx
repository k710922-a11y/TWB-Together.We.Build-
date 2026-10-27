import Link from "next/link";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { requireUser } from "@/lib/auth";
import { listUsers } from "@/lib/queries";
import { FEED_KINDS, participationFeed, participationSummary, type FeedKind, type MemberStats } from "@/lib/participation";
import { KIND_COLOR, KIND_LABEL, describe, hrefOf } from "@/lib/participation-format";
import { Avatar, Empty } from "@/components/ui";
import { ROLE_LABEL, fmtRelative } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "참여 로그" };

const PERIODS = [{ v: "7", l: "7일" }, { v: "30", l: "30일" }, { v: "90", l: "90일" }, { v: "all", l: "전체" }];

export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireUser();
  const sp = await searchParams;
  const isAdmin = me.role === "admin";
  // 관리자가 아니면 본인 기록만 볼 수 있다
  if (!isAdmin && sp.user !== me.id) redirect(`/team?user=${me.id}`);

  const [users, stats] = await Promise.all([listUsers(), participationSummary()]);
  const statOf = (id: string): MemberStats => stats.get(id) ?? {
    userId: id, active7: 0, active30: 0, activeDays30: 0, lastAccess: null, lastAction: null, daily: Array(14).fill(0), openTasks: 0, completed30: 0, kinds30: {},
  };

  if (sp.user) {
    const u = users.find((x) => x.id === sp.user);
    if (!u) redirect("/team");
    const days = sp.period === "all" ? null : Number(sp.period ?? 30) || 30;
    const kind = FEED_KINDS.includes(sp.kind as FeedKind) ? (sp.kind as FeedKind) : null;
    const limit = Math.min(1000, Number(sp.limit ?? 100) || 100);
    const feed = await participationFeed(u.id, { days, kind, limit });
    const s = statOf(u.id);
    const href = (patch: Record<string, string | null>) => {
      const q = new URLSearchParams({ user: u.id });
      const cur = { period: sp.period ?? null, kind: sp.kind ?? null, ...patch };
      for (const [k, v] of Object.entries(cur)) if (v) q.set(k, v);
      return `/team?${q.toString()}`;
    };
    // 날짜(서울)별로 묶기
    const byDay = new Map<string, typeof feed.items>();
    for (const it of feed.items) {
      const day = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" }).format(new Date(it.createdAt));
      byDay.set(day, [...(byDay.get(day) ?? []), it]);
    }
    const time = (iso: string) => new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

    return (
      <div className="space-y-5 px-5 py-7 lg:px-8">
        {isAdmin && <Link href="/team" className="text-[12.5px] text-sub hover:text-brand">← 팀 전체</Link>}
        <header className="flex flex-wrap items-center gap-4">
          <Avatar name={u.name} color={u.color} size={48} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-bold tracking-tight">{u.name} <span className="text-[14px] font-normal text-sub">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}{!u.active && " · 해지됨"}</span></h1>
            <p className="mt-0.5 text-[13px] text-sub">
              {u.online ? <span className="text-st-done">● 지금 온라인</span> : s.lastAccess ? `마지막 접속 ${fmtRelative(s.lastAccess)}` : "접속 기록 없음"}
              {s.lastAction && ` · 마지막 활동 ${fmtRelative(s.lastAction)}`}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="참여일 (30일)" value={`${s.activeDays30}일`} />
          <Stat label="활동 (7일)" value={s.active7} />
          <Stat label="활동 (30일)" value={s.active30} />
          <Stat label="진행 중 담당" value={s.openTasks} />
          <Stat label="완료 처리 (30일)" value={s.completed30} />
        </div>

        <section className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold">최근 14일 활동</h2>
            <div className="flex flex-wrap gap-1.5">
              {FEED_KINDS.filter((k) => k !== "access" && s.kinds30[k]).map((k) => (
                <span key={k} className="flex items-center gap-1 text-[12px] text-sub"><span className="h-2 w-2 rounded-full" style={{ background: KIND_COLOR[k] }} />{KIND_LABEL[k]} {s.kinds30[k]}</span>
              ))}
            </div>
          </div>
          <Daily daily={s.daily} big />
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <Link key={p.v} href={href({ period: p.v === "30" ? null : p.v, limit: null })} scroll={false}
                  className={clsx("rounded-lg border px-3 py-1.5 text-[12.5px]", (sp.period ?? "30") === p.v ? "border-brand bg-brand-50 font-semibold text-brand" : "border-line text-sub hover:bg-canvas")}>{p.l}</Link>
              ))}
            </div>
            <span className="mx-1 h-5 w-px bg-line" />
            <div className="flex flex-wrap gap-1">
              <Link href={href({ kind: null, limit: null })} scroll={false} className={clsx("rounded-full px-3 py-1 text-[12.5px]", !kind ? "bg-ink text-white" : "bg-canvas text-sub hover:text-ink")}>전체</Link>
              {FEED_KINDS.map((k) => (
                <Link key={k} href={href({ kind: k, limit: null })} scroll={false}
                  className={clsx("rounded-full px-3 py-1 text-[12.5px]", kind === k ? "bg-ink text-white" : "bg-canvas text-sub hover:text-ink")}>{KIND_LABEL[k]}</Link>
              ))}
            </div>
          </div>

          {feed.items.length === 0 ? <Empty>이 기간에 기록된 활동이 없습니다.</Empty> : (
            <div className="space-y-5">
              {[...byDay].map(([day, items]) => (
                <div key={day}>
                  <h3 className="mb-1.5 text-[12.5px] font-bold text-sub">{day} <span className="font-normal text-faint">· {items.length}건</span></h3>
                  <ul className="card divide-y divide-line">
                    {items.map((it, i) => {
                      const { text, quote } = describe(it);
                      const link = hrefOf(it);
                      const body = (
                        <>
                          <span className="w-[42px] shrink-0 pt-px text-[12px] tabular-nums text-faint">{time(it.createdAt)}</span>
                          <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full" style={{ background: KIND_COLOR[it.kind] }} title={KIND_LABEL[it.kind]} />
                          <span className="min-w-0 flex-1">
                            <span className="text-[13.5px]">{text}</span>
                            {quote && <span className="mt-0.5 block truncate text-[12.5px] text-sub">“{quote}”</span>}
                          </span>
                          {it.projectTitle && <span className="hidden shrink-0 rounded-md bg-canvas px-2 py-0.5 text-[11.5px] text-sub sm:block">{it.projectTitle}</span>}
                        </>
                      );
                      return (
                        <li key={i}>
                          {link
                            ? <Link href={link} className="flex items-start gap-3 px-4 py-2.5 hover:bg-canvas">{body}</Link>
                            : <div className="flex items-start gap-3 px-4 py-2.5">{body}</div>}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {feed.hasMore && (
                <div className="text-center"><Link href={href({ limit: String(limit + 100) })} scroll={false} className="btn-ghost">더 보기</Link></div>
              )}
            </div>
          )}
        </section>
      </div>
    );
  }

  // ── 팀 전체 요약 (관리자) ─────────────────────────────
  const rows = users.map((u) => ({ u, s: statOf(u.id) })).sort((a, b) => Number(b.u.active) - Number(a.u.active) || b.s.active30 - a.s.active30);
  const team7 = rows.filter((r) => r.u.active).reduce((n, r) => n + r.s.active7, 0);
  const quiet = rows.filter((r) => r.u.active && r.s.active7 === 0);
  return (
    <div className="space-y-5 px-5 py-7 lg:px-8">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">참여 로그</h1>
        <p className="mt-1 text-[13px] text-sub">태스크·댓글·게시판·자료실·미팅·접속 기록을 팀원별로 모아 봅니다. 최근 7일 팀 활동 {team7}건{quiet.length > 0 && ` · 7일간 활동 없는 팀원 ${quiet.length}명`}</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-[13px]">
          <thead className="bg-canvas text-left text-[12px] text-sub">
            <tr>
              <th className="px-4 py-2.5 font-medium">팀원</th>
              <th className="px-3 font-medium">마지막 접속</th>
              <th className="px-3 text-right font-medium">참여일<br /><span className="font-normal">30일</span></th>
              <th className="px-3 text-right font-medium">활동<br /><span className="font-normal">7일 / 30일</span></th>
              <th className="px-3 font-medium">최근 14일</th>
              <th className="px-3 text-right font-medium">진행 중<br /><span className="font-normal">담당</span></th>
              <th className="px-3 text-right font-medium">완료 처리<br /><span className="font-normal">30일</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map(({ u, s }) => (
              <tr key={u.id} className={clsx("hover:bg-canvas/60", !u.active && "opacity-50")}>
                <td className="px-4 py-3">
                  <Link href={`/team?user=${u.id}`} className="flex items-center gap-2.5 hover:text-brand">
                    <Avatar name={u.name} color={u.color} size={30} />
                    <span><span className="block font-semibold">{u.name}</span><span className="text-[11.5px] text-faint">{ROLE_LABEL[u.role as keyof typeof ROLE_LABEL]}{!u.active && " · 해지됨"}</span></span>
                  </Link>
                </td>
                <td className="px-3">{u.online ? <span className="text-st-done">● 온라인</span> : s.lastAccess ? <span className="text-sub">{fmtRelative(s.lastAccess)}</span> : <span className="text-faint">—</span>}</td>
                <td className="px-3 text-right font-semibold tabular-nums">{s.activeDays30}</td>
                <td className={clsx("px-3 text-right tabular-nums", u.active && s.active7 === 0 && "text-pri-high")}>{s.active7} / {s.active30}</td>
                <td className="px-3"><Daily daily={s.daily} /></td>
                <td className="px-3 text-right tabular-nums">{s.openTasks}</td>
                <td className="px-3 text-right tabular-nums">{s.completed30}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[12px] text-faint">활동 = 태스크 변경·댓글·게시글·자료·미팅·프로젝트·인원 관리 기록 (접속은 제외). 참여일 = 접속을 포함해 기록이 있는 날 수. 접속은 6시간 넘게 쉬었다가 다시 들어올 때 1회 기록됩니다.</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card px-4 py-3">
      <div className="text-[12px] text-sub">{label}</div>
      <div className="mt-0.5 text-[22px] font-bold tabular-nums">{value}</div>
    </div>
  );
}

/** 14일 일별 활동 막대 (가장 오른쪽이 오늘) */
function Daily({ daily, big }: { daily: number[]; big?: boolean }) {
  const max = Math.max(1, ...daily);
  const h = big ? 72 : 26;
  return (
    <div className={clsx("flex items-end", big ? "mt-4 gap-1.5" : "gap-[3px]")} style={{ height: h + (big ? 18 : 0) }} aria-label={`최근 14일 활동 ${daily.join(", ")}`}>
      {daily.map((n, i) => (
        <div key={i} className="flex flex-col items-center" style={{ width: big ? undefined : 7, flex: big ? 1 : undefined }}>
          <div className={clsx("w-full rounded-sm", n ? "bg-brand" : "bg-line")} style={{ height: n ? Math.max(3, (n / max) * h) : 3, opacity: n ? 0.45 + 0.55 * (n / max) : 1 }} title={`${13 - i === 0 ? "오늘" : `${13 - i}일 전`}: ${n}건`} />
          {big && <span className="mt-1 text-[10px] text-faint">{13 - i === 0 ? "오늘" : i % 2 === 1 ? "" : `-${13 - i}`}</span>}
        </div>
      ))}
    </div>
  );
}

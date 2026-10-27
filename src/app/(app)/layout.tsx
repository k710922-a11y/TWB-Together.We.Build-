import { requireUser } from "@/lib/auth";
import { boardPosts, listUsers, pendingInvites } from "@/lib/queries";
import { Providers } from "@/components/ui";
import { NavLinks } from "@/components/sidebar/NavLinks";
import { MiniBoard } from "@/components/sidebar/MiniBoard";
import { TeamPanel } from "@/components/sidebar/TeamPanel";

export const dynamic = "force-dynamic";

/**
 * 초대 링크에 쓸 공개 주소. Vercel의 팀 전용 주소(…-projects.vercel.app)는 배포 보호(Vercel 로그인)에 걸리므로
 * APP_URL → Vercel 정식(production) 주소 순으로 고르고, 둘 다 없으면 화면의 현재 주소를 쓴다.
 */
function publicOrigin(): string | null {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return null;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireUser();
  const [users, posts, invites] = await Promise.all([listUsers(), boardPosts(), me.role === "admin" ? pendingInvites() : Promise.resolve([])]);
  return (
    <Providers>
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 flex-col overflow-y-auto border-r border-line bg-white lg:flex">
          <NavLinks me={me} />
          <MiniBoard me={me} posts={posts} />
          <TeamPanel me={me} users={users.filter((u) => u.active)}
            invites={invites.map((i) => ({ id: i.id, email: i.email, role: i.role, token: i.token, createdAt: i.createdAt.toISOString() }))}
            maxMembers={Number(process.env.MAX_MEMBERS ?? 10)}
            publicOrigin={publicOrigin()} />
        </aside>
        <div className="min-w-0 flex-1">
          {/* 모바일 상단 바 */}
          <div className="border-b border-line lg:hidden"><NavLinks me={me} compact /></div>
          {children}
        </div>
      </div>
    </Providers>
  );
}

import { requireUser } from "@/lib/auth";
import { boardPosts, listUsers, pendingInvites } from "@/lib/queries";
import { Providers } from "@/components/ui";
import { NavLinks } from "@/components/sidebar/NavLinks";
import { MiniBoard } from "@/components/sidebar/MiniBoard";
import { TeamPanel } from "@/components/sidebar/TeamPanel";

export const dynamic = "force-dynamic";

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
            maxMembers={Number(process.env.MAX_MEMBERS ?? 10)} />
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

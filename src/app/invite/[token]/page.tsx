import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { acceptInviteAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";
import { ROLE_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "초대 수락" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [inv] = await db.select().from(schema.invites)
    .where(and(eq(schema.invites.token, token), isNull(schema.invites.acceptedAt))).limit(1);
  if (!inv) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas p-4">
        <div className="card max-w-sm p-7 text-center">
          <h1 className="text-lg font-bold">초대 링크가 유효하지 않습니다</h1>
          <p className="mt-2 text-[13px] text-sub">이미 사용했거나 취소된 링크입니다. 관리자에게 새 링크를 요청하세요.</p>
        </div>
      </main>
    );
  }
  return (
    <AuthCard title="TWB 팀에 초대되었습니다" subtitle={`${ROLE_LABEL[inv.role as keyof typeof ROLE_LABEL]} 권한으로 참여합니다.`}
      submit="가입하고 시작하기" action={acceptInviteAction} hidden={{ token }}
      fields={[
        { name: "email", label: "이메일", defaultValue: inv.email, readOnly: true },
        { name: "name", label: "이름", placeholder: "팀에서 불릴 이름" },
        { name: "password", label: "비밀번호 (8자 이상)", type: "password", autoComplete: "new-password" },
      ]} />
  );
}

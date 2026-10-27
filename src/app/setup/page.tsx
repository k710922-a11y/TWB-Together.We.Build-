import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { setupAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "초기 설정" };

export default async function SetupPage() {
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n > 0) redirect("/login");
  return (
    <AuthCard title="처음 오셨네요" subtitle="관리자 계정을 만들면 팀원을 초대할 수 있습니다." submit="시작하기" action={setupAction}
      fields={[
        { name: "name", label: "이름", placeholder: "예: 정수" },
        { name: "email", label: "이메일", type: "email", autoComplete: "email" },
        { name: "password", label: "비밀번호 (8자 이상)", type: "password", autoComplete: "new-password" },
        { name: "project", label: "첫 프로젝트 이름 (선택)", placeholder: "예: K-thang MVP" },
      ]} />
  );
}

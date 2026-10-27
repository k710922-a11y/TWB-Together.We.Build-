import { redirect } from "next/navigation";
import { count } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { loginAction } from "@/app/actions/auth";
import { AuthCard } from "@/components/AuthCard";

export const dynamic = "force-dynamic";
export const metadata = { title: "로그인" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/");
  const [{ n }] = await db.select({ n: count() }).from(schema.users);
  if (n === 0) redirect("/setup");
  return (
    <AuthCard title="로그인" subtitle="팀 계정으로 로그인하세요." submit="로그인" action={loginAction}
      fields={[
        { name: "email", label: "이메일", type: "email", autoComplete: "email" },
        { name: "password", label: "비밀번호", type: "password", autoComplete: "current-password" },
      ]} />
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ArrowUpRight, LogOut } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui";

const LINKS = [
  { href: "/", label: "홈" },
  { href: "/my", label: "내 할 일" },
  { href: "/projects", label: "프로젝트" },
  { href: "/library", label: "자료실" },
  { href: "/meetings", label: "미팅 로그" },
];
/** DG&F 사내 인트라넷 (전자결재·조직도·재무). 주소가 바뀌면 NEXT_PUBLIC_INTRANET_URL로 덮어쓴다. */
const INTRANET_URL = process.env.NEXT_PUBLIC_INTRANET_URL ?? "https://dgf-intranet.vercel.app";

const teamLink = (me: CurrentUser) => ({ href: me.role === "admin" ? "/team" : `/team?user=${me.id}`, label: me.role === "admin" ? "참여 로그" : "내 활동" });

export function NavLinks({ me, compact }: { me: CurrentUser; compact?: boolean }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href.split("?")[0]));
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-3 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <Brand compact />
        </Link>
        <nav aria-label="주 메뉴" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {[...LINKS, teamLink(me)].map((l) => (
          <Link key={l.href} href={l.href} className={clsx("shrink-0 rounded-md px-2.5 py-1.5 text-[13px]", active(l.href) ? "bg-brand-50 font-semibold text-brand" : "text-ink")}>{l.label}</Link>
        ))}
        </nav>
        <a href={INTRANET_URL} target="_blank" rel="noopener noreferrer" aria-label="DG&F 인트라넷 열기 (새 탭)" title="DG&F 인트라넷"
          className="shrink-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"><IntranetMark size={26} /></a>
      </div>
    );
  }
  return (
    <div className="px-3 pt-5">
      <div className="mb-5 flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          <Brand />
        </Link>
        <form action={logoutAction} className="flex items-center gap-1.5">
          <Avatar name={me.name} color={me.color} size={22} />
          <button className="rounded p-1 text-faint hover:bg-canvas hover:text-ink" title="로그아웃"><LogOut size={15} /></button>
        </form>
      </div>
      <nav className="space-y-0.5">
        {[...LINKS, teamLink(me)].map((l) => (
          <Link key={l.href} href={l.href}
            className={clsx("block rounded-lg px-3 py-2.5 text-[14px]", active(l.href) ? "bg-brand-50 font-semibold text-brand" : "text-ink hover:bg-canvas")}>
            {l.label}
          </Link>
        ))}
      </nav>
      <a href={INTRANET_URL} target="_blank" rel="noopener noreferrer" aria-label="DG&F 인트라넷 열기 (새 탭)"
        className="group mt-3 flex items-center gap-3 rounded-xl border border-[#2A2E4D] bg-[#15172A] px-3 py-2.5 text-white transition-colors hover:border-[#4A55D8] hover:bg-[#1D2040] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
        <IntranetMark size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-semibold leading-tight">DG&amp;F 인트라넷</span>
          <span className="mt-0.5 truncate text-[11px] leading-tight text-[#B9BDD9]">전자결재 · 조직도 · 재무</span>
        </span>
        <ArrowUpRight size={15} className="shrink-0 text-[#B9BDD9] transition-colors group-hover:text-white" aria-hidden="true" />
      </a>
    </div>
  );
}

/** 인트라넷 파비콘과 같은 DG&F 마크 */
function IntranetMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <rect width="64" height="64" rx="14" fill="#2f3fb8" />
      <path fill="#fff" fillRule="evenodd" d="M16 13h14a19 19 0 0 1 0 38H16zM25 22v20h5a10 10 0 0 0 0-20z" />
      <circle cx="31" cy="32" r="4.5" fill="#ffc24b" />
    </svg>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <span className={clsx("inline-flex shrink-0 items-center justify-center rounded-lg bg-brand font-black text-white", compact ? "h-7 w-7 text-[13px]" : "h-8 w-8 text-[15px]")}>T</span>
      <span className="flex flex-col">
        <span className={clsx("font-bold leading-tight", compact ? "text-[14px]" : "text-[16px]")}>TWB</span>
        <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium leading-tight text-sub">Together We Build</span>
      </span>
    </>
  );
}

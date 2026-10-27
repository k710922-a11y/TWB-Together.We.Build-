"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LogOut } from "lucide-react";
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

export function NavLinks({ me, compact }: { me: CurrentUser; compact?: boolean }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  if (compact) {
    return (
      <div className="flex items-center gap-1 overflow-x-auto px-3 py-2">
        <span className="mr-2 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand text-[13px] font-black text-white">T</span>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={clsx("shrink-0 rounded-md px-2.5 py-1.5 text-[13px]", active(l.href) ? "bg-brand-50 font-semibold text-brand" : "text-ink")}>{l.label}</Link>
        ))}
      </div>
    );
  }
  return (
    <div className="px-3 pt-5">
      <div className="mb-5 flex items-center justify-between px-2">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-[15px] font-black text-white">T</span>
          <span className="text-[16px] font-bold">TWB</span>
        </Link>
        <form action={logoutAction} className="flex items-center gap-1.5">
          <Avatar name={me.name} color={me.color} size={22} />
          <button className="rounded p-1 text-faint hover:bg-canvas hover:text-ink" title="로그아웃"><LogOut size={15} /></button>
        </form>
      </div>
      <nav className="space-y-0.5">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href}
            className={clsx("block rounded-lg px-3 py-2.5 text-[14px]", active(l.href) ? "bg-brand-50 font-semibold text-brand" : "text-ink hover:bg-canvas")}>
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

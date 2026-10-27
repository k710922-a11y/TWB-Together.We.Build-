"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CurrentUser, Role } from "@/lib/auth";
import type { UserLite } from "@/lib/queries";
import { cancelInvite, changeRole, deactivateMember, inviteMember, renewInvite } from "@/app/actions/members";
import { Avatar, MenuItem, Modal, Popover, useAction, useToast } from "@/components/ui";
import { fmtRelative, ROLE_LABEL } from "@/lib/format";

type Invite = { id: string; email: string; role: string; token: string; createdAt: string };

export function TeamPanel({ me, users, invites, maxMembers }: { me: CurrentUser; users: UserLite[]; invites: Invite[]; maxMembers: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("editor");
  const [link, setLink] = useState<string | null>(null);
  const { exec, pending } = useAction();
  const toast = useToast();
  const isAdmin = me.role === "admin";
  const inviteUrl = (token: string) => `${window.location.origin}/invite/${token}`;
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast("초대 링크를 복사했습니다."); } catch { setLink(url); }
  };

  return (
    <section className="mt-auto border-t border-line px-3 pb-4 pt-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[13px] font-bold">팀 인원 <span className="font-normal text-faint">{users.length} / {maxMembers}명</span></h3>
        {isAdmin && <button onClick={() => { setOpen(true); setLink(null); }} className="btn-primary btn-sm">+ 초대</button>}
      </div>
      <ul className="mt-2.5 space-y-0.5">
        {users.map((u) => (
          <li key={u.id} className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${u.id === me.id ? "bg-brand-50/60" : ""}`}>
            <Avatar name={u.name} color={u.color} size={30} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{u.name}</div>
              <div className={`text-[11px] ${u.online ? "text-st-done" : "text-faint"}`}>{u.online ? "● 온라인" : "○ 오프라인"}</div>
            </div>
            {isAdmin && u.id !== me.id ? (
              <div className="flex items-center gap-1">
                <Popover align="right" trigger={(_, t) => (
                  <button onClick={t} className="flex h-6 items-center gap-0.5 rounded-md border border-line px-1.5 text-[11px]">{ROLE_LABEL[u.role as Role]}<ChevronDown size={11} /></button>
                )}>
                  {(close) => (["admin", "editor", "viewer"] as Role[]).map((r) => (
                    <MenuItem key={r} active={u.role === r} onClick={() => { close(); exec(() => changeRole(u.id, r), { ok: "역할을 바꿨습니다." }); }}>{ROLE_LABEL[r]}</MenuItem>
                  ))}
                </Popover>
                <button onClick={() => confirm(`${u.name}님을 해지할까요?\n담당 태스크는 미배정으로 바뀌고, 댓글 기록은 유지됩니다.`) && exec(() => deactivateMember(u.id), { ok: "해지했습니다." })}
                  className="h-6 rounded-md border border-[#f5c2cb] px-1.5 text-[11px] text-pri-high hover:bg-[#fff1f3]">해지</button>
              </div>
            ) : (
              <span className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand">{ROLE_LABEL[u.role as Role]}</span>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && invites.map((i) => (
        <div key={i.id} className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-line px-2.5 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-semibold">{i.email}</div>
            <div className="text-[11px] text-pri-mid">초대 대기 · {fmtRelative(i.createdAt)}</div>
          </div>
          <button onClick={() => copy(inviteUrl(i.token))} className="h-6 rounded-md border border-line px-1.5 text-[11px]">링크</button>
          <button onClick={() => exec(() => renewInvite(i.id), { onOk: (d) => copy(inviteUrl(d.token)) })} className="h-6 rounded-md border border-line px-1.5 text-[11px]">재발송</button>
          <button onClick={() => exec(() => cancelInvite(i.id))} className="h-6 rounded-md border border-line px-1.5 text-[11px]">취소</button>
        </div>
      ))}
      {isAdmin && <p className="mt-2 px-1 text-[11px] leading-relaxed text-faint">해지 시 담당 태스크는 미배정으로 바뀌고, 댓글 기록은 유지됩니다.</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="팀원 초대" width={440}>
        {link ? (
          <div>
            <p className="text-[13px] text-sub">아래 링크를 초대할 분께 전달하세요. (14일 동안 유효)</p>
            <input readOnly value={link} className="input mt-2" onFocus={(e) => e.target.select()} />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn-ghost" onClick={() => copy(link)}>복사</button>
              <button className="btn-primary" onClick={() => setOpen(false)}>완료</button>
            </div>
          </div>
        ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            exec(() => inviteMember(email, role), { onOk: (d) => { setEmail(""); const url = inviteUrl(d.token); setLink(url); navigator.clipboard?.writeText(url).catch(() => {}); } });
          }}>
            <label className="label">이메일</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="minji@example.com" />
            <label className="label mt-3">역할</label>
            <div className="flex gap-2">
              {(["editor", "viewer", "admin"] as Role[]).map((r) => (
                <button type="button" key={r} onClick={() => setRole(r)}
                  className={`flex-1 rounded-lg border px-2 py-2 text-[13px] ${role === r ? "border-brand bg-brand-50 font-semibold text-brand" : "border-line"}`}>{ROLE_LABEL[r]}</button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-faint">편집자: 태스크·문서 편집 / 보기: 읽기와 댓글만 / 관리자: 인원 관리 포함</p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>취소</button>
              <button className="btn-primary" disabled={pending}>초대 링크 만들기</button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  );
}

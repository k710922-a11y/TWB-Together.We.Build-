"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Heart, Paperclip, Trash2 } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import type { BoardPost } from "@/lib/queries";
import { createPost, deletePost, replyPost, toggleLike } from "@/app/actions/board";
import { Avatar, downloadFile, uploadFile, useAction, useToast } from "@/components/ui";
import { fmtStamp } from "@/lib/format";

/** @이름 멘션을 강조 표시 */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(@[^\s@]+)/g);
  return <>{parts.map((p, i) => (p.startsWith("@") ? <span key={i} className="font-semibold text-brand">{p}</span> : p))}</>;
}

export function MiniBoard({ me, posts }: { me: CurrentUser; posts: BoardPost[] }) {
  const [text, setText] = useState("");
  const [notice, setNotice] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { exec, pending } = useAction();
  const toast = useToast();

  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    let fileId: string | null = null;
    try {
      if (file) fileId = (await uploadFile(file, { category: "게시판 첨부" })).id;
    } catch (e) {
      toast((e as Error).message, "err"); setBusy(false); return;
    }
    exec(() => createPost(text, notice, fileId), { onOk: () => { setText(""); setFile(null); setNotice(false); } });
    setBusy(false);
  }

  return (
    <section className="mt-6 border-t border-line px-3 pt-4">
      <h3 className="px-1 text-[13px] font-bold">미니 게시판 <span className="font-normal text-faint">{posts.length}개 글</span></h3>
      <div className="mt-2.5 rounded-xl border border-line p-2.5">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="공지나 의견을 남겨 주세요"
          className="w-full resize-none text-[13px] outline-none placeholder:text-faint" />
        {file && <div className="mb-1 truncate text-[12px] text-sub">📎 {file.name}</div>}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[12px] text-faint">
            <button type="button" onClick={() => setText((t) => t + "@")} className="hover:text-ink">@ 멘션</button>
            <span>·</span>
            <button type="button" onClick={() => fileRef.current?.click()} className="hover:text-ink">파일</button>
            <input ref={fileRef} type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {me.role === "admin" && (
              <label className="ml-1 flex items-center gap-1"><input type="checkbox" checked={notice} onChange={(e) => setNotice(e.target.checked)} />공지</label>
            )}
          </div>
          <button onClick={submit} disabled={pending || busy || !text.trim()} className="btn-primary btn-sm">등록</button>
        </div>
      </div>
      <div className="mt-3 space-y-3 pb-2">
        {posts.map((p) => <PostCard key={p.id} p={p} me={me} />)}
      </div>
    </section>
  );
}

function PostCard({ p, me }: { p: BoardPost; me: CurrentUser }) {
  const [reply, setReply] = useState("");
  const [open, setOpen] = useState(false);
  const { exec } = useAction();
  const toast = useToast();
  const liked = p.likes.includes(me.id);
  return (
    <article className={clsx("rounded-xl border p-3", p.isNotice ? "border-brand/30 bg-brand-50/40" : "border-line")}>
      <header className="flex items-center gap-2">
        <Avatar name={p.userName} color={p.userColor} size={22} />
        <span className="text-[13px] font-semibold">{p.userName ?? "(탈퇴)"}</span>
        {p.isNotice && <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-bold text-brand">공지</span>}
        <span className="ml-auto text-[11px] text-faint">{fmtStamp(p.createdAt)}</span>
      </header>
      <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed"><Rich text={p.content} /></p>
      {p.fileId && (
        <button onClick={() => downloadFile(p.fileId!).catch((e) => toast((e as Error).message, "err"))}
          className="mt-1.5 flex max-w-full items-center gap-1 truncate text-[12px] text-brand hover:underline">
          <Paperclip size={12} />{p.fileName}
        </button>
      )}
      <div className="mt-2 flex items-center gap-3 text-[11px] text-faint">
        <button onClick={() => setOpen((o) => !o)} className="hover:text-ink">답글 {p.replies.length}</button>
        <button onClick={() => exec(() => toggleLike(p.id))} className={clsx("flex items-center gap-0.5 hover:text-ink", liked && "text-pri-high")}>
          <Heart size={11} fill={liked ? "currentColor" : "none"} /> {p.likes.length}
        </button>
        {(p.userId === me.id || me.role === "admin") && (
          <button onClick={() => confirm("이 글을 삭제할까요?") && exec(() => deletePost(p.id))} className="ml-auto hover:text-pri-high"><Trash2 size={11} /></button>
        )}
      </div>
      {(open || p.replies.length > 0) && (
        <div className="mt-2 space-y-1.5">
          {p.replies.map((r) => (
            <div key={r.id} className="rounded-lg bg-canvas px-2.5 py-2">
              <div className="flex justify-between text-[11px]"><b>{r.userName ?? "(탈퇴)"}</b><span className="text-faint">{fmtStamp(r.createdAt)}</span></div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px]"><Rich text={r.content} /></p>
            </div>
          ))}
          <form onSubmit={(e) => { e.preventDefault(); if (reply.trim()) exec(() => replyPost(p.id, reply), { onOk: () => setReply("") }); }}>
            <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="답글 달기…" className="input h-8 text-[12px]" />
          </form>
        </div>
      )}
    </article>
  );
}

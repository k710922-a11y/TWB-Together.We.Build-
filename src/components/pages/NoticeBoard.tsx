"use client";
import Link from "next/link";
import { useState } from "react";
import { Megaphone, MessageSquare, Paperclip, Pencil, Pin, PinOff, Plus, Trash2, X } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import type { BoardPost } from "@/lib/queries";
import { createPost, deletePost, editPost, replyPost, setPostNotice } from "@/app/actions/board";
import { Avatar, downloadFile, useAction, useToast } from "@/components/ui";
import { fmtStamp } from "@/lib/format";

export function NoticeBoard({me,posts,total,compact=false}:{me:CurrentUser;posts:BoardPost[];total:number;compact?:boolean}){
 const [composing,setComposing]=useState(false),[text,setText]=useState("");
 const {exec,pending}=useAction();
 return <section className="card overflow-hidden" aria-label="공지사항">
  <div className="flex flex-wrap items-center justify-between gap-3 bg-brand px-4 py-3 text-white sm:px-5">
   <div className="flex items-center gap-2"><Megaphone size={18} aria-hidden="true"/><h2 className="text-[16px] font-bold">공지사항</h2><span className="rounded-full bg-white/20 px-2 text-[12px]">{total}</span></div>
   <div className="flex items-center gap-3">
    {me.role==="admin"&&<button type="button" disabled={pending} className="inline-flex min-h-8 items-center gap-1 rounded px-2 text-[12.5px] font-semibold hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" onClick={()=>setComposing(v=>!v)}>{composing?<X size={14}/>:<Plus size={14}/>} {composing?"닫기":"공지 작성"}</button>}
    {compact&&<Link className="rounded text-[12.5px] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href="/notices">전체 보기</Link>}
   </div>
  </div>
  {composing&&me.role==="admin"&&<form className="space-y-3 border-b border-line bg-brand-50/30 p-4 sm:p-5" onSubmit={e=>{e.preventDefault();if(text.trim())exec(()=>createPost(text,true),{ok:"공지를 등록했습니다.",onOk:()=>{setText("");setComposing(false);}});}}>
   <label className="block text-[13px] font-semibold" htmlFor="notice-composer">팀원에게 공유할 공지</label>
   <textarea id="notice-composer" rows={4} className="input min-h-28 resize-y" placeholder="중요한 일정, 결정 사항, 팀원에게 전할 내용을 적어 주세요." required maxLength={5000} value={text} onChange={e=>setText(e.target.value)} disabled={pending} autoFocus/>
   <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[12px] text-sub">등록한 공지는 홈 상단에 고정됩니다. · {text.length.toLocaleString()}/5,000자</span><button className="btn-primary btn-sm" disabled={pending||!text.trim()}>{pending?"등록 중…":"공지 등록"}</button></div>
  </form>}
  {posts.length?<div className="divide-y divide-line">{posts.map(post=><NoticeCard key={post.id} me={me} post={post}/>)}</div>:<div className="px-5 py-7 text-center"><p className="text-[13.5px] text-sub">등록된 공지사항이 없습니다.</p>{me.role==="admin"&&<p className="mt-1 text-[12px] text-faint">공지 작성으로 팀원에게 중요한 내용을 공유해 보세요.</p>}</div>}
  {compact&&total>posts.length&&<Link className="block border-t border-line px-4 py-3 text-center text-[13px] font-semibold text-brand hover:bg-canvas" href="/notices">이전 공지 더 보기</Link>}
 </section>;
}
function NoticeCard({me,post}:{me:CurrentUser;post:BoardPost}){
 const {exec,pending}=useAction(),toast=useToast();
 const [editing,setEditing]=useState(false),[draft,setDraft]=useState(post.content),[expanded,setExpanded]=useState(false),[replies,setReplies]=useState(false),[reply,setReply]=useState("");
 const canExpand=post.content.length>100||post.content.includes("\n");
 return <article className="p-4 sm:p-5">
  <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
   <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold text-brand"><Pin size={11} aria-hidden="true"/>중요 공지</span>
   <Avatar name={post.userName} color={post.userColor} size={23}/>
   <span className="text-[13px] font-semibold">{post.userName??"(탈퇴)"}</span>
   <time dateTime={post.createdAt} className="text-[12px] text-faint">{fmtStamp(post.createdAt)}</time>
   {me.role==="admin"&&!editing&&<div className="ml-auto flex items-center gap-1">
    <button type="button" className="rounded p-2 text-sub hover:bg-canvas" aria-label="공지 수정" title="수정" disabled={pending} onClick={()=>{setDraft(post.content);setEditing(true);}}><Pencil size={14}/></button>
    <button type="button" className="rounded p-2 text-sub hover:bg-canvas" aria-label="공지 고정 해제" title="고정 해제 · 미니 게시판에 보관" disabled={pending} onClick={()=>window.confirm("홈 공지 고정을 해제할까요? 글은 미니 게시판에 남습니다.")&&exec(()=>setPostNotice(post.id,false),{ok:"공지 고정을 해제했습니다."})}><PinOff size={14}/></button>
    <button type="button" className="rounded p-2 text-sub hover:bg-red-50 hover:text-red-700" aria-label="공지 삭제" title="삭제" disabled={pending} onClick={()=>window.confirm("이 공지와 답글을 삭제할까요?")&&exec(()=>deletePost(post.id),{ok:"공지를 삭제했습니다."})}><Trash2 size={14}/></button>
   </div>}
  </header>
  {editing?<form className="mt-3 space-y-2" onSubmit={e=>{e.preventDefault();exec(()=>editPost(post.id,draft),{ok:"공지를 수정했습니다.",onOk:()=>setEditing(false)});}}>
   <label htmlFor={"notice-edit-"+post.id} className="sr-only">공지 내용 수정</label><textarea id={"notice-edit-"+post.id} className="input min-h-28 resize-y" rows={4} required maxLength={5000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={pending} autoFocus/>
   <div className="flex gap-2"><button className="btn-primary btn-sm" disabled={pending||!draft.trim()}>{pending?"저장 중…":"수정 저장"}</button><button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={()=>setEditing(false)}>취소</button></div>
  </form>:<>
   <p className={"mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed "+(!expanded&&canExpand?"line-clamp-4":"")}>{post.content}</p>
   {canExpand&&<button type="button" className="mt-1 text-[12px] font-medium text-brand" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?"접기":"내용 펼치기"}</button>}
  </>}
  {post.fileId&&<button type="button" className="mt-2 flex max-w-full items-center gap-1.5 text-[12.5px] text-brand hover:underline" onClick={()=>downloadFile(post.fileId!).catch(e=>toast((e as Error).message,"err"))}><Paperclip size={13}/><span className="truncate">{post.fileName??"첨부 파일"}</span></button>}
  <button type="button" className="mt-3 flex min-h-8 items-center gap-1.5 rounded text-[12px] text-sub hover:text-brand" aria-expanded={replies} aria-controls={"notice-replies-"+post.id} onClick={()=>setReplies(v=>!v)}><MessageSquare size={14}/>답글 {post.replies.length}</button>
  {replies&&<div id={"notice-replies-"+post.id} className="mt-2 space-y-2 border-l-2 border-brand/20 pl-3">
   {post.replies.map(r=><div key={r.id} className="rounded-lg bg-canvas px-3 py-2"><div className="flex flex-wrap gap-x-2 text-[12px]"><b>{r.userName??"(탈퇴)"}</b><time className="text-faint" dateTime={r.createdAt}>{fmtStamp(r.createdAt)}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-[13px]">{r.content}</p></div>)}
   <form className="flex items-end gap-2" onSubmit={e=>{e.preventDefault();if(reply.trim())exec(()=>replyPost(post.id,reply),{ok:"답글을 등록했습니다.",onOk:()=>setReply("")});}}>
    <label htmlFor={"notice-reply-"+post.id} className="sr-only">공지 답글</label><textarea id={"notice-reply-"+post.id} className="input min-h-10 flex-1 resize-y text-[13px]" rows={1} placeholder="확인 내용이나 의견을 남겨 주세요." required maxLength={2000} value={reply} onChange={e=>setReply(e.target.value)} disabled={pending}/>
    <button className="btn-primary btn-sm shrink-0" disabled={pending||!reply.trim()}>등록</button>
   </form>
  </div>}
 </article>;
}

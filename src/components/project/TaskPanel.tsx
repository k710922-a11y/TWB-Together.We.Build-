"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Sparkles, Trash2, X } from "lucide-react";
import type { CurrentUser } from "@/lib/auth";
import type { TaskDetail, TaskRow, UserLite } from "@/lib/queries";
import { addComment, createTask, deleteComment, deleteTask, setDependencies, updateTask } from "@/app/actions/tasks";
import { Avatar, useAction } from "@/components/ui";
import { fmtKoDate, fmtStamp } from "@/lib/format";
import { AssigneeCell, DateCell, PriorityCell, StatusCell, useOpenTask, useTaskUpdate } from "./cells";

const ACTION_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  created: () => "태스크를 만들었습니다",
  status: (d) => `상태: ${d.from} → ${d.to}`,
  assignee: (d) => `담당자를 ${d.to}(으)로 변경`,
  due: (d) => `마감일을 ${d.to ? fmtKoDate(String(d.to)) : "없음"}(으)로 변경`,
  start: (d) => `시작일을 ${d.to ? fmtKoDate(String(d.to)) : "없음"}(으)로 변경`,
  priority: (d) => `우선순위를 ${d.to}(으)로 변경`,
  title: (d) => `이름을 "${d.to}"(으)로 변경`,
  deps: (d) => `선행 태스크 지정: ${d.to}`,
  from_meeting: (d) => `미팅 "${d.meeting}"에서 자동 생성`,
};

export function TaskPanel({ detail, tasks, deps, users, me, editable }: {
  detail: TaskDetail; tasks: TaskRow[]; deps: { taskId: string; dependsOnId: string }[];
  users: UserLite[]; me: CurrentUser; editable: boolean;
}) {
  const { task: t, comments, activity, meeting } = detail;
  const openTask = useOpenTask();
  const { exec, pending } = useAction();
  const { update } = useTaskUpdate();
  const [title, setTitle] = useState(t.title);
  const [desc, setDesc] = useState(t.description ?? "");
  const [comment, setComment] = useState("");
  const [tab, setTab] = useState<"comments" | "activity">("comments");
  useEffect(() => { setTitle(t.title); setDesc(t.description ?? ""); }, [t.id, t.title, t.description]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && openTask(null);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [openTask]);

  const parent = t.parentId ? tasks.find((x) => x.id === t.parentId) : null;
  const subs = tasks.filter((x) => x.parentId === t.id);
  const myDeps = deps.filter((d) => d.taskId === t.id).map((d) => d.dependsOnId);
  const depCandidates = tasks.filter((x) => !x.parentId && x.id !== t.id);

  return (
    <>
      <div className="fixed inset-0 z-30 bg-[#1f2440]/20" onClick={() => openTask(null)} />
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[520px] flex-col border-l border-line bg-white shadow-2xl">
        <header className="flex items-center gap-2 border-b border-line px-5 py-3">
          {parent && <button onClick={() => openTask(parent.id)} className="truncate text-[12.5px] text-sub hover:text-brand">{parent.title} /</button>}
          {t.source === "meeting" && <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand"><Sparkles size={11} />자동 생성</span>}
          <div className="ml-auto flex items-center gap-1">
            {editable && (
              <button onClick={() => confirm("이 태스크를 삭제할까요?" + (subs.length ? ` 서브태스크 ${subs.length}개도 함께 삭제됩니다.` : "")) &&
                exec(() => deleteTask(t.id), { ok: "삭제했습니다.", onOk: () => openTask(null) })}
                className="rounded p-1.5 text-faint hover:bg-[#fff1f3] hover:text-pri-high" title="삭제"><Trash2 size={16} /></button>
            )}
            <button onClick={() => openTask(null)} className="rounded p-1.5 text-sub hover:bg-canvas" aria-label="닫기"><X size={18} /></button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!editable} rows={1}
            onBlur={() => title.trim() && title !== t.title && update(t, { title })}
            className="w-full resize-none text-[19px] font-bold leading-snug outline-none" />

          <dl className="mt-3 grid grid-cols-[88px_1fr] items-center gap-y-3 text-[13px]">
            <dt className="text-sub">상태</dt><dd><StatusCell t={t} editable={editable} /></dd>
            <dt className="text-sub">담당자</dt><dd><AssigneeCell t={t} users={users} editable={editable} /></dd>
            <dt className="text-sub">시작일</dt><dd><DateCell t={t} field="startDate" editable={editable} /></dd>
            <dt className="text-sub">마감일</dt><dd><DateCell t={t} editable={editable} /></dd>
            <dt className="text-sub">우선순위</dt><dd><PriorityCell t={t} editable={editable} /></dd>
            {meeting && (<><dt className="text-sub">출처</dt><dd><Link href={`/meetings/${meeting.id}`} className="text-brand hover:underline">{meeting.title}</Link></dd></>)}
            {!t.parentId && (
              <>
                <dt className="self-start pt-1 text-sub">선행 태스크</dt>
                <dd>
                  <div className="flex flex-wrap gap-1.5">
                    {myDeps.map((id) => (
                      <span key={id} className="flex items-center gap-1 rounded-md bg-canvas px-2 py-1 text-[12px]">
                        {tasks.find((x) => x.id === id)?.title}
                        {editable && <button onClick={() => exec(() => setDependencies(t.id, myDeps.filter((x) => x !== id)))} className="text-faint hover:text-pri-high"><X size={11} /></button>}
                      </span>
                    ))}
                    {editable && (
                      <select className="h-7 rounded-md border border-line px-1.5 text-[12px]" value=""
                        onChange={(e) => e.target.value && exec(() => setDependencies(t.id, [...myDeps, e.target.value]), { ok: "선행 태스크를 지정했습니다." })}>
                        <option value="">+ 추가</option>
                        {depCandidates.filter((x) => !myDeps.includes(x.id)).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                      </select>
                    )}
                  </div>
                </dd>
              </>
            )}
          </dl>

          <h4 className="mt-6 text-[13px] font-bold">설명</h4>
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} readOnly={!editable} rows={4}
            placeholder={editable ? "배경, 완료 조건, 참고 링크 등을 적어 두세요" : "설명 없음"}
            onBlur={() => desc !== (t.description ?? "") && exec(() => updateTask(t.id, t.version, { description: desc }))}
            className="textarea mt-1.5" />

          {!t.parentId && (
            <>
              <h4 className="mt-6 text-[13px] font-bold">서브태스크 <span className="font-normal text-faint">{subs.filter((s) => s.status === "done").length}/{subs.length}</span></h4>
              <ul className="mt-1.5 space-y-1">
                {subs.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-canvas">
                    <input type="checkbox" checked={s.status === "done"} disabled={!editable} className="accent-[#5b5bf0]"
                      onChange={() => update(s, { status: s.status === "done" ? "todo" : "done" })} />
                    <button onClick={() => openTask(s.id)} className={clsx("flex-1 truncate text-left text-[13px]", s.status === "done" && "text-sub line-through")}>{s.title}</button>
                    <span className="text-[12px] text-faint">{users.find((u) => u.id === s.assigneeId)?.name}</span>
                  </li>
                ))}
              </ul>
              {editable && <SubAdd onAdd={(title) => exec(() => createTask({ projectId: t.projectId, parentId: t.id, title }))} />}
            </>
          )}

          <div className="mt-7 flex gap-4 border-b border-line text-[13px]">
            {(["comments", "activity"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={clsx("-mb-px border-b-2 pb-2", tab === k ? "border-brand font-semibold text-brand" : "border-transparent text-sub")}>
                {k === "comments" ? `댓글 ${comments.length}` : `이력 ${activity.length}`}
              </button>
            ))}
          </div>
          {tab === "comments" ? (
            <div className="mt-3 space-y-3">
              {comments.length === 0 && <p className="text-[13px] text-faint">첫 의견을 남겨 보세요. 결정·피드백이 이 태스크 옆에 기록으로 남습니다.</p>}
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar name={c.userName} color={c.userColor} size={26} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px]"><b>{c.userName ?? "(해지된 팀원)"}</b><span className="text-faint">{fmtStamp(c.createdAt)}</span>
                      {(c.userId === me.id || me.role === "admin") && (
                        <button onClick={() => confirm("댓글을 삭제할까요?") && exec(() => deleteComment(c.id))} className="ml-auto text-faint hover:text-pri-high"><Trash2 size={12} /></button>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
              <form className="pt-1" onSubmit={(e) => { e.preventDefault(); exec(() => addComment(t.id, comment), { onOk: () => setComment("") }); }}>
                <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="댓글을 입력하세요 (Ctrl+Enter로 등록)" className="textarea"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && comment.trim()) exec(() => addComment(t.id, comment), { onOk: () => setComment("") }); }} />
                <div className="mt-2 flex justify-end"><button className="btn-primary btn-sm" disabled={pending || !comment.trim()}>등록</button></div>
              </form>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2 text-[12.5px]">
                  <span className="w-[74px] shrink-0 text-faint">{fmtStamp(a.createdAt)}</span>
                  <span><b>{a.userName ?? "시스템"}</b> · {(ACTION_TEXT[a.action] ?? (() => a.action))(a.detail ?? {})}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

function SubAdd({ onAdd }: { onAdd: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <input value={v} onChange={(e) => setV(e.target.value)} placeholder="+ 서브태스크 추가 (Enter)" className="input mt-1.5 h-8"
      onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { e.preventDefault(); onAdd(v.trim()); setV(""); } }} />
  );
}

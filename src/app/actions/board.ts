"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { assertRole } from "@/lib/auth";
import { run, UserError } from "@/lib/result";
import { canModifyPost, noticeContent } from "@/lib/notice-policy";

const refresh = () => revalidatePath("/", "layout");

export async function createPost(content: string, isNotice: boolean, fileId?: string | null) {
  return run(async () => {
    const me = await assertRole("viewer"); // 게시판은 보기 권한도 의견을 남길 수 있음
    const text = content.trim();
    if (!text) throw new UserError("내용을 입력해 주세요.");
    if (isNotice && me.role !== "admin") throw new UserError("공지는 관리자만 등록할 수 있습니다.");
    if (isNotice) noticeContent(text);
    await db.insert(schema.posts).values({ userId: me.id, content: text, isNotice, fileId: fileId ?? null });
    refresh();
    return null;
  });
}

export async function deletePost(id: string) {
  return run(async () => {
    const me = await assertRole("viewer");
    const [p] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1);
    if (!p) return null;
    if (!canModifyPost(me, p)) throw new UserError(p.isNotice ? "공지는 관리자만 삭제할 수 있습니다." : "본인 글만 삭제할 수 있습니다.");
    await db.delete(schema.posts).where(eq(schema.posts.id, id));
    refresh();
    return null;
  });
}

export async function replyPost(postId: string, content: string) {
  return run(async () => {
    const me = await assertRole("viewer");
    const text = content.trim();
    if (!text) throw new UserError("내용을 입력해 주세요.");
    await db.insert(schema.postReplies).values({ postId, userId: me.id, content: text });
    refresh();
    return null;
  });
}

export async function toggleLike(postId: string) {
  return run(async () => {
    const me = await assertRole("viewer");
    const where = and(eq(schema.postLikes.postId, postId), eq(schema.postLikes.userId, me.id));
    const [hit] = await db.select().from(schema.postLikes).where(where).limit(1);
    if (hit) await db.delete(schema.postLikes).where(where);
    else await db.insert(schema.postLikes).values({ postId, userId: me.id });
    refresh();
    return null;
  });
}

export async function editPost(id: string, content: string) {
 return run(async () => {
  const me=await assertRole("viewer");
  const [post]=await db.select().from(schema.posts).where(eq(schema.posts.id,id)).limit(1);
  if(!post)throw new UserError("글을 찾을 수 없습니다.");
  if(!canModifyPost(me,post))throw new UserError(post.isNotice?"공지는 관리자만 수정할 수 있습니다.":"본인 글만 수정할 수 있습니다.");
  const text=post.isNotice?noticeContent(content):content.trim();
  if(!text)throw new UserError("내용을 입력해 주세요.");
  await db.update(schema.posts).set({content:text}).where(eq(schema.posts.id,id));
  refresh();return null;
 });
}
export async function setPostNotice(id: string, isNotice: boolean) {
 return run(async () => {
  await assertRole("admin");
  const [post]=await db.select().from(schema.posts).where(eq(schema.posts.id,id)).limit(1);
  if(!post)throw new UserError("글을 찾을 수 없습니다.");
  if(isNotice)noticeContent(post.content);
  await db.update(schema.posts).set({isNotice}).where(eq(schema.posts.id,id));
  refresh();return null;
 });
}

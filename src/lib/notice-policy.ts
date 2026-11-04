type Actor = { id: string; role: string };
type Post = { userId: string | null; isNotice: boolean };
/** 공지는 관리자만, 일반 의견은 작성자 또는 관리자가 변경한다. */
export function canModifyPost(actor: Actor, post: Post): boolean {
 return post.isNotice ? actor.role === "admin" : actor.role === "admin" || post.userId === actor.id;
}
export function noticeContent(input: string): string {
 const text=input.trim();
 if(!text)throw new Error("공지 내용을 입력해 주세요.");
 if(text.length>5000)throw new Error("공지 내용은 5,000자까지 입력할 수 있습니다.");
 return text;
}

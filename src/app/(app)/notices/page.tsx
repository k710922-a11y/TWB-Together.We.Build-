import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { boardPosts, countNotices } from "@/lib/queries";
import { NoticeBoard } from "@/components/pages/NoticeBoard";
export const dynamic="force-dynamic";
export const metadata={title:"공지사항"};
export default async function Notices({searchParams}:{searchParams:Promise<{page?:string}>}){
 const me=await requireUser();const sp=await searchParams;
 const page=Math.max(1,Math.min(100000,Number.parseInt(sp.page??"1",10)||1)),size=20;
 const [posts,total]=await Promise.all([boardPosts(size,true,(page-1)*size),countNotices()]);
 const pages=Math.max(1,Math.ceil(total/size));if(page>pages)redirect("/notices?page="+pages);
 return <div className="space-y-5 px-5 py-7 lg:px-8">
  <div className="flex items-center justify-between gap-3"><div><h1 className="text-[24px] font-bold tracking-tight">공지사항</h1><p className="mt-1 text-[13px] text-sub">팀의 중요한 일정과 결정 사항을 공유합니다.</p></div><Link href="/" className="text-[13px] text-brand">홈으로</Link></div>
  <NoticeBoard me={me} posts={posts} total={total}/>
  {pages>1&&<nav className="flex items-center justify-center gap-4 text-[13px]" aria-label="공지 페이지">{page>1&&<Link className="btn-ghost btn-sm" href={"/notices?page="+(page-1)}>이전</Link>}<span>{page} / {pages}</span>{page<pages&&<Link className="btn-ghost btn-sm" href={"/notices?page="+(page+1)}>다음</Link>}</nav>}
 </div>;
}

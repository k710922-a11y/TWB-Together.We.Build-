import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canEdit, requireUser } from "@/lib/auth";
import { docRefsByFile } from "@/lib/library";
import { INLINE_IMAGE_MAX } from "@/lib/file-refs";
import { FileActions } from "@/components/pages/FileActions";
import { fmtBytes, fmtStamp } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FilePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ download?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const { download } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await db.select({ f: schema.files, by: schema.users.name, project: schema.projects.title })
    .from(schema.files).leftJoin(schema.users, eq(schema.users.id, schema.files.uploadedBy))
    .leftJoin(schema.projects, eq(schema.projects.id, schema.files.projectId))
    .where(eq(schema.files.id, id)).limit(1);
  if (!row || !row.f.complete) notFound();
  const f = row.f;
  const [refs, projects] = await Promise.all([
    docRefsByFile(),
    db.select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.archived, false)),
  ]);
  const docs = refs.get(f.id) ?? [];
  const isImage = f.kind === "file" && f.mime?.startsWith("image/") && (f.size ?? 0) <= INLINE_IMAGE_MAX;

  return (
    <div className="mx-auto max-w-[900px] space-y-5 px-5 py-7 lg:px-8">
      <div className="text-[12.5px] text-sub"><Link href="/library" className="hover:text-brand">자료실</Link> / {row.project ?? "공통"}</div>
      <div className="card p-6">
        <h1 className="break-all text-[20px] font-bold">{f.kind === "link" ? "🔗 " : "📎 "}{f.name}</h1>
        <dl className="mt-4 grid grid-cols-[96px_1fr] gap-y-2 text-[13px]">
          <dt className="text-sub">프로젝트</dt><dd>{row.project ?? "공통"}</dd>
          {f.category && <><dt className="text-sub">분류</dt><dd>{f.category}</dd></>}
          {f.kind === "file" ? <><dt className="text-sub">크기</dt><dd>{fmtBytes(f.size)} · {f.mime}</dd></>
            : <><dt className="text-sub">주소</dt><dd className="break-all"><a href={f.url!} target="_blank" rel="noreferrer" className="text-brand hover:underline">{f.url}</a></dd></>}
          <dt className="text-sub">올린 사람</dt><dd>{row.by ?? "—"} · {fmtStamp(f.createdAt)}</dd>
          {f.note && <><dt className="text-sub">메모</dt><dd className="whitespace-pre-wrap">{f.note}</dd></>}
        </dl>
        <FileActions file={{ id: f.id, kind: f.kind, name: f.name, url: f.url, category: f.category, note: f.note, projectId: f.projectId }}
          projects={projects} editable={canEdit(me)} autoDownload={download === "1"} docCount={docs.length} />
        {isImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/files/${f.id}?raw=1`} alt={f.name} className="mt-5 max-h-[520px] rounded-lg border border-line" />
        )}
      </div>
      <section className="card p-5">
        <h2 className="text-[14px] font-bold">이 파일을 쓰는 문서 <span className="font-normal text-faint">{docs.length}</span></h2>
        {docs.length ? (
          <ul className="mt-2 space-y-1">
            {docs.map((d) => <li key={d.id}><Link href={`/library/docs/${d.id}`} className="text-[13.5px] text-brand hover:underline">📄 {d.title}</Link></li>)}
          </ul>
        ) : <p className="mt-2 text-[13px] text-sub">아직 이 파일을 넣은 위키 문서가 없습니다. 문서 편집 화면의 &lsquo;파일 첨부&rsquo;로 연결할 수 있습니다.</p>}
      </section>
    </div>
  );
}

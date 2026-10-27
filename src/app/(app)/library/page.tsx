import { asc, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canEdit, requireUser } from "@/lib/auth";
import { Library } from "@/components/pages/Library";

export const dynamic = "force-dynamic";
export const metadata = { title: "자료실" };

export default async function LibraryPage() {
  const me = await requireUser();
  const [docs, files, projects, [{ bytes }]] = await Promise.all([
    db.select({ id: schema.docs.id, title: schema.docs.title, folder: schema.docs.folder, projectId: schema.docs.projectId,
      updatedAt: schema.docs.updatedAt, updatedBy: schema.users.name })
      .from(schema.docs).leftJoin(schema.users, eq(schema.users.id, schema.docs.updatedBy))
      .orderBy(asc(schema.docs.folder), desc(schema.docs.updatedAt)),
    db.select({ id: schema.files.id, kind: schema.files.kind, name: schema.files.name, url: schema.files.url, size: schema.files.size,
      category: schema.files.category, note: schema.files.note, projectId: schema.files.projectId, complete: schema.files.complete,
      createdAt: schema.files.createdAt, uploadedBy: schema.users.name })
      .from(schema.files).leftJoin(schema.users, eq(schema.users.id, schema.files.uploadedBy))
      .orderBy(desc(schema.files.createdAt)),
    db.select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.archived, false)),
    db.execute<{ bytes: string }>(`select coalesce(sum(size),0)::bigint as bytes from files where kind = 'file' and complete`),
  ]);
  return (
    <Library editable={canEdit(me)} projects={projects}
      docs={docs.map((d) => ({ ...d, updatedAt: d.updatedAt.toISOString() }))}
      files={files.filter((f) => f.complete).map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
      usedBytes={Number(bytes)} />
  );
}

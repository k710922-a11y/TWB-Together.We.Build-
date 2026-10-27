import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { canEdit, requireUser } from "@/lib/auth";
import { DocEditor } from "@/components/pages/DocEditor";

export const dynamic = "force-dynamic";

export default async function DocPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }> }) {
  const me = await requireUser();
  const { id } = await params;
  const { edit } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [d] = await db.select({ doc: schema.docs, by: schema.users.name }).from(schema.docs)
    .leftJoin(schema.users, eq(schema.users.id, schema.docs.updatedBy)).where(eq(schema.docs.id, id)).limit(1);
  if (!d) notFound();
  const [projects, files] = await Promise.all([
    db.select({ id: schema.projects.id, title: schema.projects.title }).from(schema.projects).where(eq(schema.projects.archived, false)),
    db.select({ id: schema.files.id, kind: schema.files.kind, name: schema.files.name, mime: schema.files.mime, url: schema.files.url,
      size: schema.files.size, projectId: schema.files.projectId, category: schema.files.category })
      .from(schema.files).where(eq(schema.files.complete, true)).orderBy(desc(schema.files.createdAt)),
  ]);
  return (
    <DocEditor files={files} editable={canEdit(me)} startEditing={edit === "1"} projects={projects}
      doc={{ id: d.doc.id, title: d.doc.title, folder: d.doc.folder, content: d.doc.content, projectId: d.doc.projectId, version: d.doc.version,
        updatedAt: d.doc.updatedAt.toISOString(), updatedBy: d.by }} />
  );
}

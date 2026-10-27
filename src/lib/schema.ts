import { customType } from "drizzle-orm/pg-core";
import {
  pgTable, uuid, text, timestamp, date, integer, boolean, jsonb, primaryKey, index, bigint,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/* ── 사람·인증 ─────────────────────────────────────── */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("editor"), // admin | editor | viewer
  color: text("color").notNull().default("#5b5bf0"),
  active: boolean("active").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  role: text("role").notNull().default("editor"),
  token: text("token").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── 프로젝트·태스크 ───────────────────────────────── */
export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  description: text("description"),
  launchDate: date("launch_date"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const milestones = pgTable("milestones", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  date: date("date").notNull(),
  done: boolean("done").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  // 서브태스크는 1단계만 허용 (서브태스크의 서브태스크 금지 — 앱 레벨에서 검사)
  parentId: uuid("parent_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("todo"), // todo | in_progress | review | done
  priority: text("priority").notNull().default("medium"), // low | medium | high
  assigneeId: uuid("assignee_id").references(() => users.id, { onDelete: "set null" }),
  startDate: date("start_date"),
  dueDate: date("due_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  // 낙관적 잠금: 수정할 때마다 +1, 다른 사람이 먼저 바꿨으면 충돌로 처리
  version: integer("version").notNull().default(1),
  source: text("source").notNull().default("manual"), // manual | meeting
  meetingId: uuid("meeting_id"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("tasks_project_idx").on(t.projectId), index("tasks_parent_idx").on(t.parentId)]);

export const taskDependencies = pgTable("task_dependencies", {
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  dependsOnId: uuid("depends_on_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.taskId, t.dependsOnId] })]);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("comments_task_idx").on(t.taskId)]);

export const taskActivity = pgTable("task_activity", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("activity_task_idx").on(t.taskId)]);

/* ── 자료실 ────────────────────────────────────────── */
export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("file"), // file | link
  name: text("name").notNull(),
  url: text("url"), // kind=link
  mime: text("mime"),
  size: bigint("size", { mode: "number" }),
  // 업로드 진행 상태: 청크가 모두 들어오면 complete=true
  complete: boolean("complete").notNull().default(true),
  category: text("category"),
  note: text("note"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** 파일 본문은 3MB 청크로 DB에 저장 (Vercel 함수 요청/응답 4.5MB 한도를 넘지 않기 위해) */
export const fileChunks = pgTable("file_chunks", {
  fileId: uuid("file_id").notNull().references(() => files.id, { onDelete: "cascade" }),
  idx: integer("idx").notNull(),
  data: bytea("data").notNull(),
}, (t) => [primaryKey({ columns: [t.fileId, t.idx] })]);

export const docs = pgTable("docs", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  folder: text("folder").notNull().default("일반"),
  title: text("title").notNull(),
  content: text("content").notNull().default(""),
  version: integer("version").notNull().default(1),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── 미니 게시판 ───────────────────────────────────── */
export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isNotice: boolean("is_notice").notNull().default(false),
  fileId: uuid("file_id").references(() => files.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postReplies = pgTable("post_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  postId: uuid("post_id").notNull().references(() => posts.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (t) => [primaryKey({ columns: [t.postId, t.userId] })]);

/* ── 미팅 로그 ─────────────────────────────────────── */
export type MeetingStep = { key: string; label: string; state: "pending" | "running" | "done" | "failed" };

export const meetings = pgTable("meetings", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  heldOn: date("held_on").notNull(),
  durationMin: integer("duration_min"),
  attendees: text("attendees"),
  // 녹음은 저장하지 않고 Gemini Files API로 바로 전달 (48시간 후 구글 측 자동 삭제)
  audioName: text("audio_name"),
  audioMime: text("audio_mime"),
  audioSize: bigint("audio_size", { mode: "number" }),
  uploadUrl: text("upload_url"),
  uploadedBytes: bigint("uploaded_bytes", { mode: "number" }).notNull().default(0),
  geminiFileName: text("gemini_file_name"),
  geminiFileUri: text("gemini_file_uri"),
  transcriptParts: jsonb("transcript_parts").$type<string[]>(),
  pendingActions: jsonb("pending_actions").$type<{ title: string; assignee: string | null; dueDate: string | null }[]>(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  notes: text("notes"), // 직접 입력한 회의록/메모 (녹음 없이도 사용 가능)
  transcript: text("transcript"),
  summary: jsonb("summary").$type<string[]>(),
  decisions: jsonb("decisions").$type<string[]>(),
  status: text("status").notNull().default("draft"), // draft | uploading | processing | done | failed
  steps: jsonb("steps").$type<MeetingStep[]>(),
  error: text("error"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── 참여 로그 ─────────────────────────────────────────
 * 태스크 변경(task_activity)·댓글·게시판은 각 테이블에서 바로 모으고,
 * 그 밖의 활동(접속·문서·자료·미팅·프로젝트·인원 관리)만 여기에 남긴다.
 */
export const activityLog = pgTable("activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(), // access | library | meeting | project | admin
  action: text("action").notNull(),
  label: text("label"),
  targetId: uuid("target_id"),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("activity_log_user_idx").on(t.userId, t.createdAt)]);

// 로컬 확인용 데모 데이터 (시안의 K-thang MVP 예시). 운영 DB에는 실행하지 마세요.
import postgres from "postgres";
import bcrypt from "bcryptjs";

const sql = postgres(process.env.DATABASE_URL ?? "postgres://twb:twb@localhost:5432/twb", { prepare: false });
const hash = await bcrypt.hash("password123", 10);
const people = [
  ["민수", "minsu@example.com", "admin", "#f5a623"], ["지우", "jiwoo@example.com", "editor", "#00b26b"],
  ["서연", "seoyeon@example.com", "editor", "#5b5bf0"], ["현우", "hyunwoo@example.com", "viewer", "#a25ddc"],
  ["준호", "junho@example.com", "editor", "#2f80ed"],
];
const ids = {};
for (const [name, email, role, color] of people) {
  const [u] = await sql`insert into users (name,email,password_hash,role,color,last_seen_at) values (${name},${email},${hash},${role},${color}, ${name === "민수" || name === "지우" ? new Date() : null}) returning id`;
  ids[name] = u.id;
}
const [p] = await sql`insert into projects (title, description, launch_date) values ('K-thang MVP', 'K-pop 커버댄스 플랫폼 MVP 개발', '2026-11-17') returning id`;
for (const [i, [t, d, done]] of [["기획 확정", "2026-10-21", true], ["MVP 기능 개발", "2026-10-31", false], ["베타 배포", "2026-11-10", false], ["정식 오픈", "2026-11-17", false]].entries())
  await sql`insert into milestones (project_id,title,date,done,sort_order) values (${p.id},${t},${d},${done},${i})`;
let order = 0;
const task = async (title, status, who, start, due, priority = "medium", parent = null) => {
  const [t] = await sql`insert into tasks (project_id,parent_id,title,status,priority,assignee_id,start_date,due_date,sort_order) values (${p.id},${parent},${title},${status},${priority},${who ? ids[who] : null},${start},${due},${order++}) returning id`;
  return t.id;
};
const t1 = await task("테이블 뷰 인라인 편집 구현", "in_progress", "민수", "2026-10-21", "2026-10-27", "high");
await task("셀 편집 컴포넌트 분리", "done", "민수", null, "2026-10-24", "medium", t1);
await task("낙관적 업데이트 적용", "done", "민수", null, "2026-10-25", "medium", t1);
await task("Server Action 연결", "in_progress", "지우", null, "2026-10-26", "medium", t1);
await task("에러 토스트 처리", "todo", "민수", null, "2026-10-27", "medium", t1);
const t2 = await task("칸반 드래그 앤 드롭 상태 반영", "review", "지우", "2026-10-25", "2026-10-29");
const t3 = await task("태스크 댓글과 이력 표시", "todo", "서연", "2026-10-29", "2026-11-03");
const t4 = await task("Supabase RLS 점검", "done", "준호", "2026-10-19", "2026-10-26", "high");
const t5 = await task("미니PC 배포 설정", "in_progress", "준호", "2026-10-30", "2026-11-04");
const t6 = await task("미팅 로그 자동화", "todo", "현우", "2026-11-05", "2026-11-12");
await sql`insert into task_dependencies (task_id, depends_on_id) values (${t5}, ${t2}), (${t6}, ${t1})`;
await sql`insert into comments (task_id,user_id,content) values (${t1},${ids["지우"]},'Server Action 연결 PR 올렸습니다. 리뷰 부탁드려요.')`;
const [post] = await sql`insert into posts (user_id,content,is_notice) values (${ids["민수"]},'[결정] 칸반 상태 반영은 이번 주 안에 마무리하고, 배포는 다음 주로 미룹니다.',true) returning id`;
await sql`insert into post_replies (post_id,user_id,content) values (${post.id},${ids["지우"]},'배포를 미루면 베타 일정도 같이 밀리나요?'),(${post.id},${ids["민수"]},'네, 11/10 베타는 유지하고 배포만 1주 뒤로 옮깁니다.')`;
await sql`insert into post_likes (post_id,user_id) values (${post.id},${ids["지우"]}),(${post.id},${ids["서연"]})`;
await sql`insert into posts (user_id,content) values (${ids["서연"]},'댓글 이력 UI 와이어프레임을 자료실에 올렸습니다. @지우 확인 부탁드려요')`;
await sql`insert into docs (title, folder, content, project_id, updated_by) values ('K-thang 협업툴 개발기획서','기획','# K-thang 협업툴 개발기획서\n\n10인 미만 팀이 **자료 공유, 비동기 토론, 회의 로그**를 한곳에서 관리합니다.\n\n## 유지할 핵심 기능\n- 테이블 뷰\n- 칸반 뷰\n- 미팅 로그\n', ${p.id}, ${ids["민수"]})`;
await sql`insert into files (kind,name,url,category,project_id,uploaded_by) values ('link','메인 화면 Figma','https://www.figma.com/','디자인',${p.id},${ids["서연"]})`;
console.log("seeded. login: minsu@example.com / password123");
await sql.end();

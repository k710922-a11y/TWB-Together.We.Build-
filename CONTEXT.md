# TWB 개발 컨텍스트 (LLM에게 함께 넘기는 파일)

## 무엇
10인 이내 팀의 비동기 협업툴. 실시간 채팅·알림 없음. 기록(태스크 댓글, 미니 게시판, 위키, 미팅 로그) 중심.

## 스택
- Next.js 16 App Router (서버 컴포넌트 + 서버 액션), React 19, TypeScript strict
- Tailwind CSS v4 (`src/app/globals.css`의 @theme 토큰, 공용 클래스는 `@utility`로 정의)
- DB: Supabase Postgres, Drizzle ORM (`src/lib/schema.ts`), 연결은 트랜잭션 풀러 + `prepare:false`
- 배포: Vercel (서울 icn1), GitHub main 푸시 → 자동 배포
- 인증: 자체 이메일/비밀번호 + 세션 쿠키(`twb_session`), 초대 링크 가입. Supabase Auth 미사용
- AI: Gemini REST API (`src/lib/gemini.ts`)

## 규칙
- 서버 액션은 반드시 `run()`으로 감싸고 `assertRole()`로 권한 확인 → 실패는 `{ok:false,error}`로 반환
- 역할: admin(인원 관리) / editor(편집) / viewer(읽기·댓글·게시판만)
- 태스크 수정은 `version` 낙관적 잠금. 충돌 시 화면 새로고침 + 토스트
- 서브태스크는 1단계까지만
- Vercel 함수 한도: 요청/응답 4.5MB, 실행 최대 300초 → 파일은 3MB 청크(DB `file_chunks`), 녹음은 청크로 Gemini에 중계, 녹음 정리는 화면이 `advanceMeeting`을 반복 호출해 한 단계씩 진행
- 모든 public 테이블은 RLS ON + 정책 없음(공개 API 차단). 앱은 `twb_app` 계정(RLS 우회)으로만 접근
- 스키마 변경: `src/lib/schema.ts` 수정 → `npm run db:generate` → 생성된 SQL을 Supabase에 적용(+ 새 테이블은 RLS 켜기)
- UI 문구는 한국어, 색·간격은 globals.css 토큰 사용

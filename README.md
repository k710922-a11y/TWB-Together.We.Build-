# TWB — Together.We.Build

10인 이내 팀을 위한 가벼운 **비동기 협업툴**. Monday.com에서 꼭 필요한 것만 남겼습니다.

- **프로젝트 보드**: 진척도·마일스톤 / 테이블(인라인 편집, 서브태스크 1단계) / 칸반(드래그 앤 드롭) / 간트(의존 관계) / 대시보드
- **태스크 상세**: 댓글, 변경 이력, 선행 태스크, 동시 수정 충돌 감지
- **미팅 로그**: 녹음 업로드 → Gemini가 받아 적기 → 요약·결정 사항·할 일 추출 → 태스크 자동 등록
- **자료실**: 마크다운 위키 + 파일(최대 50MB)·링크 보관
- **미니 게시판**: 공지, 답글, 좋아요, @멘션 표시
- **팀 인원**: 초대 링크, 관리자/편집자/보기 권한, 해지(담당 태스크는 미배정, 기록 유지)

## 구성 (모두 무료 플랜)
| 영역 | 서비스 |
|---|---|
| 웹/서버 | Vercel Hobby (서울 리전) — GitHub `main` 푸시 시 자동 배포 |
| DB | Supabase Free (서울) — Postgres 500MB |
| AI | Gemini API 무료 티어 (무료 티어 데이터는 구글 품질 개선에 쓰일 수 있음) |

## 처음 설정
1. Vercel 환경 변수: `DATABASE_URL`, `GEMINI_API_KEY` (`.env.example` 참고)
2. 배포 주소에 접속 → 관리자 계정 생성(최초 1회) → 왼쪽 아래 **+ 초대**로 팀원 초대 링크 전달

## 로컬 개발
```bash
npm install
cp .env.example .env.local   # DATABASE_URL을 로컬 Postgres로, GEMINI_MOCK=1
psql "$DATABASE_URL" -f drizzle/0000_init.sql
npm run seed:demo            # 데모 데이터 (minsu@example.com / password123)
npm run dev
```

## 제한과 운영 메모
- 녹음 파일은 저장하지 않습니다. Gemini에 바로 전달되고 정리가 끝나면 구글 쪽에서도 삭제합니다(최대 48시간 보관). 남는 건 받아 적은 텍스트와 요약입니다.
- 2시간 녹음은 15분 구간씩 나눠 변환합니다. 처리 중 화면을 닫아도 다시 열면 이어서 진행됩니다.
- Supabase 무료 프로젝트는 7일간 접속이 없으면 일시 정지됩니다. 대시보드에서 Restore 하면 됩니다.
- 파일 저장은 DB(500MB)를 함께 쓰므로 큰 디자인 원본·영상은 링크로 등록하세요.

개발 규칙은 [CONTEXT.md](CONTEXT.md) 참고.

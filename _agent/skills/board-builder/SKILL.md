---
name: board-builder
description: GitHub API 및 Vercel 기반 정적 게시판 홈페이지 구축 스킬
---

# Board Builder Skill

이 스킬은 GitHub API와 Vercel 서버리스 함수를 활용하여 백엔드 DB 없이 정적 게시판 홈페이지를 구축하는 방법을 정의합니다.

## 시스템 아키텍처
- **프론트엔드**: HTML, CSS (TailwindCSS CDN), Vanilla JS (`db.js`)
- **데이터 저장소**: `data/posts.json` (GitHub REST API sync & LocalStorage 캐싱)
- **인증 & 보안**: Vercel Serverless Function (`/api/config`)에서 `GITHUB_TOKEN`과 `ADMIN_PASSWORD` 주입

## 핵심 모듈 (`db.js`)
- `loadConfig()`: `/api/config`와 `config/git_config.json` 병렬 조회를 통한 토큰 및 레포 정보 로드
- `getPosts()`, `savePost()`, `deletePost()`: LocalStorage 캐시 및 GitHub REST API 자동 커밋/푸시
- `renderMarkdown()`, `markdownToText()`: 자체 경량 마크다운 파서 및 HTML 이스케이프 처리

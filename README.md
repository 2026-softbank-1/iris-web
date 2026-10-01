# Railway dashboard frontend clone

React + TypeScript + Vite로 구현한 Railway 다크 대시보드 프론트엔드 데모입니다. 실제 계정/API에는 연결하지 않습니다.

## 실행

Node.js 22.12 이상을 권장합니다.

```sh
npm install
npm run dev
```

http://localhost:5173/dashboard

```sh
npm run typecheck
npm run build
npm run preview
```

macOS 샌드박스에서 Rolldown native binding 사용이 제한되는 경우:

```sh
NAPI_RS_FORCE_WASI=true npm run dev
NAPI_RS_FORCE_WASI=true npm run build
```

CSS는 플랫폼별 Lightning CSS native 모듈에 의존하지 않도록 minify를 끈 상태입니다.

## 구현 범위

- Workspace: 프로젝트 카드/리스트, 정렬, 즐겨찾기, Templates, Usage, People, Settings
- 프로젝트: React Flow 캔버스, 서비스 노드, 패닝/확대/축소
- 서비스: Deployments, Variables, Metrics, Console, Settings
- 배포: Details, Build/Deploy/Network Logs, 검색, 단계 펼치기
- 오류 프로젝트: offline 상태, removed 배포 기록, SESSION_SECRET 길이 검증 Zod 오류 로그
- 프로젝트 Logs, Observability, Sandboxes, Settings
- 커맨드 팔레트, 업그레이드 다이얼로그, 메뉴와 드로어

## 데모 제한

실제 배포, 결제, 초대, 계정 관리 및 서버 설정 저장은 하지 않습니다. 일부 버튼은 mock 안내만 표시하며 일부 보조 설정 화면은 간소화되어 있습니다. 로그, 사용량 및 지표는 정적/샘플 데이터입니다. 전체 Railway 제품의 모든 기능 또는 픽셀 단위 동일성을 보장하지 않습니다.

주요 데스크톱 화면을 기준으로 맞췄습니다. 로고와 장식 그림은 자체 구현이며 실제 Railway 자산의 완전 복제는 아닙니다. GitHub avatar에는 외부 네트워크가 필요합니다.

## 구조

- `src/data/mock.ts`: 사용자/워크스페이스, 프로젝트, 서비스, 배포 및 로그 샘플
- `src/layouts`: Workspace/Project 공통 레이아웃
- `src/pages`: 페이지와 서비스/배포 패널
- `src/components`: 공통 UI, 커맨드 팔레트, 다이얼로그
- `src/styles`: 디자인 토큰 및 화면별 CSS

`mock.ts`에는 관찰한 이름, 이메일 및 리포지터리 메타데이터가 있습니다. 외부 공개 전에 데모 값으로 교체하세요. 실제 비밀번호나 인증 토큰은 필요하지 않습니다.

## 검증

- TypeScript 검사 통과
- WASI 환경에서 프로덕션 빌드 통과
- 브라우저에서 대시보드, 커맨드 팔레트, 서비스 패널 및 removed 배포 오류 로그 확인

## New local demo flows

- Dashboard New, command New Project, and project Add open the Create flow. GitHub sample repos support search, URL validation, review, demo deployments, logs, and reload persistence. No remote repository is fetched or deployed.
- Set localStorage key `rw:plan-limit` to `1` to reproduce the observed upgrade limit and use Continue with local demo. Remove the key to restore default behavior.
- Account Logout opens /login. Protected deep routes remain blocked after refresh. /signup leads to two-step preview onboarding and the existing demo dashboard.
- Auth/onboarding were unavailable in the authenticated reference session, so these screens explicitly identify themselves as unobserved demo reconstructions. No real auth, payment, or workspace creation.
- Checked: typecheck, production build, auth click-through, deep-route guard, repository validation, variables, build logs and persisted deployment state.

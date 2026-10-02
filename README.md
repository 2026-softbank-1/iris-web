# LikeLion dashboard frontend

React + TypeScript + Vite로 구현한 LikeLion 다크 대시보드 프론트엔드입니다. 로그인, 프로젝트, 서비스, GitHub 저장소 조회는 API 서버(was)에 연결되어 있고, 배포·로그·지표 등 API가 아직 없는 화면은 샘플입니다.

## 실행

Node.js 22.12 이상을 권장합니다.

```sh
npm install
npm run dev
```

http://localhost:5173/dashboard

로그인하려면 was(`uv run uvicorn app.main:app`)가 떠 있어야 합니다. was 가 없으면 `/login` 에 서버에 연결할 수 없다는 안내가 나옵니다.

### API 주소 (`VITE_API_BASE_URL`)

기본값은 `http://localhost:8000` 입니다. 바꾸려면 `.env.example` 을 `.env.local` 로 복사해 값을 고치고 dev 서버를 다시 띄웁니다.

- dev 서버는 브라우저 요청을 같은 origin(`/api`)으로 받아 이 주소로 프록시합니다. was 에 CORS 설정이 필요 없습니다.
- `npm run build` 결과물은 이 주소로 직접 호출합니다. 이때는 was 가 CORS(credentials)를 허용해야 합니다. 비우면 같은 origin 으로 호출합니다.
- build 기본값은 커밋된 `.env.production` 의 `https://api.likelion.uk` 입니다. Amplify 환경 변수에 `VITE_API_BASE_URL` 을 넣으면 그 값이 우선합니다. 값을 빈 문자열로 넣으면 같은 origin(`likelion.uk/api/...`)으로 호출하니 비워 두지 마세요.

### 로그인 주의

was 는 로그인이 끝나면 자기 `WEB_BASE_URL`(기본 `http://localhost:3000`)로 돌려보냅니다. 이 웹의 주소와 같아야 하므로, 둘 중 하나를 맞춥니다.

- 웹을 3000 포트로 띄웁니다: `npm run dev -- --port 3000`
- 또는 was `.env` 의 `WEB_BASE_URL` 을 `http://localhost:5173` 으로 바꾸고 was 를 다시 띄웁니다.

세션 쿠키가 호스트 단위라서 `127.0.0.1` 이 아니라 `localhost` 로 접속해야 합니다.

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

was 와 연결된 화면 (아래 엔드포인트는 모두 `/api/v1` 아래):

| 화면 | 엔드포인트 |
|---|---|
| 로그인·로그아웃·계정 | `GET /auth/github`, `POST /auth/logout`, `GET /me` |
| Dashboard 프로젝트 목록 | `GET /projects`, `GET /projects/{id}/services` |
| Create → 프로젝트 만들기 | `POST /projects` |
| Create → 저장소 검색·주소 확인 | `GET /github/repos`, `GET /github/repos/resolve`, `GET /github/installations` |
| Create → 브랜치·배포 대상 | `GET /github/repos/{owner}/{repo}/branches`, `GET /targets` |
| Create → 서비스 만들기 | `POST /projects/{id}/services` |
| Configure GitHub App | `GET /github/install` |
| 프로젝트 Settings 이름·설명, Danger | `GET·PATCH·DELETE /projects/{id}` |
| 서비스 Settings (이름, 루트 디렉터리, 브랜치, 자동 배포, 포트, 배포 대상, 빌더, 빌드·시작 명령), Danger | `GET·PATCH·DELETE /services/{id}` |
| Create 의 Deploy(첫 배포), Deploy·Redeploy·Rollback 버튼 | `POST /services/{id}/deployments` |
| Deployments 탭, Activity 드로어 | `GET /services/{id}/deployments` |
| 배포 패널 Details(상태 이력, 단계별 소요 시간) | `GET /services/{id}/deployments/{deploymentId}` |
| 서비스 공개 주소(캔버스 노드, 서비스 패널 상단, Settings 의 Public Networking) | `GET /services/{id}/domains` |
| 프로젝트 Logs (기간만큼 과거 로그를 받고, 이어서 실시간) | `GET /services/{id}/logs`, `GET /services/{id}/logs/stream` (SSE) |

웹훅(`POST /webhooks/github`)은 GitHub 가 was 를 호출하는 용도라서 웹에서는 쓰지 않습니다.

프로젝트 Logs 는 서비스마다 첫 번째 배포 대상(`targetIds[0]`)의 런타임 로그를 보여줍니다. was 에 `LOKI_URL` 이 설정돼 있지 않으면 `NOT_CONFIGURED` 오류가 납니다. 서버가 5분마다 스트림을 끊으면 브라우저가 `Last-Event-ID` 로 이어 붙고, 한 번에 받을 양을 넘으면(`overflow`) 과거 로그 조회로 따라잡습니다. 레벨은 was 가 주지 않아서 본문의 `ERROR`, `level=warn` 같은 표기로 추정합니다.

- Workspace: 프로젝트 카드/리스트, 정렬, 즐겨찾기(브라우저에 저장), Templates, Settings
- 프로젝트: React Flow 캔버스, 서비스 노드, 패닝/확대/축소
- 서비스: Deployments, Variables, Metrics, Console, Settings
- 배포: Details, Build/Deploy/Network Logs, 검색, 단계 펼치기
- 프로젝트 Logs, Observability, Sandboxes
- 커맨드 팔레트, 업그레이드 다이얼로그, 메뉴와 드로어

지표, 환경 변수, 빌드·배포 로그 API 는 was 에 아직 없어서 해당 화면은 샘플이거나 비어 있습니다.

MVP 범위 밖이라 뺀 항목: 워크스페이스 People, 프로젝트 Members, 외부 문서 링크.
워크스페이스 Usage는 코드만 남겨 두고 연결을 주석 처리했습니다.

## 제한 사항

실제 배포, 결제, 초대, 계정 관리는 하지 않습니다. 일부 버튼은 안내만 표시하며 일부 보조 설정 화면은 간소화되어 있습니다. 사용량 및 지표는 정적/샘플 데이터입니다.

서비스 상태는 was 가 서비스 응답에 붙여 주는 최근 배포(`latestDeployment`)로 정합니다. 성공·롤백됨은 online, 진행 중(QUEUED·BUILDING·DEPLOYING)은 Deploying, 실패·수동 개입은 crashed 로 표시합니다. 빌드·배포 로그는 API 가 없어서 비어 있고, Variables 탭의 값은 서버에 저장되지 않고 이 브라우저에만 남습니다.

주요 데스크톱 화면을 기준으로 맞췄습니다. 로고와 장식 그림은 자체 구현입니다. GitHub avatar에는 외부 네트워크가 필요합니다.

## 구조

- `src/lib/api.ts`, `src/lib/endpoints.ts`: was 호출(주소·오류 처리)과 엔드포인트별 함수·타입
- `src/auth/AuthContext.tsx`: 로그인 상태(`/me`), 로그인·로그아웃
- `src/data/ProjectsContext.tsx`: 프로젝트·서비스 목록과 생성·수정·삭제(was 응답을 화면 모델로 바꿈)
- `src/data/mock.ts`: 화면 모델 타입, 워크스페이스, 배포 및 로그 샘플
- `src/layouts`: Workspace/Project 공통 레이아웃
- `src/pages`: 페이지와 서비스/배포 패널
- `src/components`: 공통 UI, 커맨드 팔레트, 다이얼로그
- `src/styles`: 디자인 토큰 및 화면별 CSS

`mock.ts`에는 워크스페이스 이름과 샘플 저장소 메타데이터가 있습니다. 외부 공개 전에 실제 값으로 교체하거나 지우세요. 실제 비밀번호나 인증 토큰은 필요하지 않습니다.

## 동작

- Dashboard New, 커맨드 팔레트 New Project, 프로젝트 Create는 Create 흐름을 엽니다. 선택할 수 있는 항목은 GitHub Repository뿐이고 나머지는 Coming soon으로 표시됩니다.
- Create 에서는 GitHub App 이 접근할 수 있는 저장소만 보입니다. 저장소가 없으면 `Configure GitHub App` 으로 설치하고, 주소를 붙여넣으면 접근 권한까지 확인합니다. 브랜치와 배포 대상을 고르고(`local` 은 아직 지원하지 않아 비활성으로 표시) Deploy 를 누르면 프로젝트와 서비스를 만들고 첫 배포(MANUAL)를 요청합니다(서비스 생성이 실패하면 방금 만든 빈 프로젝트를 지우고, 첫 배포 요청만 실패하면 서비스는 남기고 알려 줍니다). Control API 는 배포 요청을 DB 에 기록하고, 빌드·배포는 Worker 가 합니다. Worker 가 없는 로컬에서는 배포가 Queued 에서 멈춥니다. 진행 중인 배포는 3초마다 다시 불러옵니다.
- 프로젝트와 서비스 삭제는 was 가 소프트 삭제로 처리합니다.
- 세션이 만료돼 API 가 401 을 주면 `/login` 으로 이동합니다.
- 로그인 여부는 시작할 때 was 의 `GET /api/v1/me` 로 확인합니다. 로그인하지 않았으면 보호된 경로는 `/login` 으로 이동하고, 로그인한 상태로 `/login` 을 열면 대시보드로 이동합니다. 회원가입과 온보딩 흐름은 없습니다.
- Logout은 was 의 `POST /api/v1/auth/logout` 으로 세션 쿠키를 지우고 `/login` 으로 이동합니다.
- 계정 이름과 아바타는 GitHub 계정에서 오지만 워크스페이스 이름과 워크스페이스 생성은 샘플입니다.

## 검증

- TypeScript 검사와 프로덕션 빌드 통과
- 로컬 was 와 브라우저로 확인: 로그인·로그아웃·세션 만료, 프로젝트·서비스 생성/수정/삭제, 저장소 검색·주소 확인·브랜치, 서비스 설정 저장(DB 반영 확인), 커맨드 팔레트, 없는 프로젝트 안내
- `VITE_API_BASE_URL` 을 닿지 않는 주소로 바꾸면 로그인 화면에 서버 연결 안내가 표시됨

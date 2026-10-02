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
| Analyze & deploy | `POST /services/{id}/pipelines` |
| 파이프라인 진행·부족 정보·취소 | `GET /services/{id}/pipelines`, `POST /services/{id}/pipelines/{pipelineId}/answers·cancel` |
| 실패 실행 회차 로그 진단 | `POST·GET /services/{id}/deployments/{deploymentId}/diagnosis` |
| Deployments 탭, Activity 드로어 | `GET /services/{id}/deployments` |
| 배포 패널 Details(상태 이력, 단계별 소요 시간) | `GET /services/{id}/deployments/{deploymentId}` |

웹훅(`POST /webhooks/github`)은 GitHub 가 was 를 호출하는 용도라서 웹에서는 쓰지 않습니다.

- Workspace: 프로젝트 카드/리스트, 정렬, 즐겨찾기(브라우저에 저장), Templates, Settings
- 프로젝트: React Flow 캔버스, 서비스 노드, 패닝/확대/축소
- 서비스: Deployments, Analysis, Variables, Metrics, Console, Settings
- 배포: Details, Build/Deploy/Network Logs, 검색, 단계 펼치기
- 프로젝트 Logs, Observability, Sandboxes
- 커맨드 팔레트, 업그레이드 다이얼로그, 메뉴와 드로어

배포 요청·상태·이력은 WAS API에 연결되어 있습니다. 빌드 로그, 지표, 환경 변수, 도메인은 아직 샘플이거나 비어 있습니다.

MVP 범위 밖이라 뺀 항목: 워크스페이스 People, 프로젝트 Members, 외부 문서 링크.
워크스페이스 Usage는 코드만 남겨 두고 연결을 주석 처리했습니다.

## 제한 사항

실제 분석·계획·빌드·배포에는 WAS의 해당 Worker와 모델·빌드·클러스터 설정이 필요합니다. 과거 commit 재배포와 수동 rollback UI는 실행 계약이 준비되지 않아 제공하지 않습니다. Analyze & deploy는 현재 선택한 브랜치의 head를 새로 분석하고 계획합니다. 실패 시 Worker의 자동 rollback은 별도의 배포 정책에 따릅니다. 결제·초대·일부 보조 설정 화면은 샘플이며, 사용량과 지표도 정적/샘플 데이터입니다. 실패 로그 진단은 수집된 실제 로그를 사용하는 WAS API에 연결되어 있습니다. 일반 Build/Deploy/Network 로그 탭은 아직 비어 있습니다.

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
- Create 에서는 GitHub App 이 접근할 수 있는 저장소만 보입니다. 저장소가 없으면 `Configure GitHub App` 으로 설치하고, 주소를 붙여넣으면 접근 권한까지 확인합니다. 브랜치와 배포 대상을 고르고(`local` 은 아직 지원하지 않아 비활성으로 표시) Analyze & deploy를 누르면 프로젝트와 서비스를 만들고 선택한 AI/static 분석→부족 정보 확인→분석 에이전트 계획 생성→Dockerfile/Railpack 빌드→배포 워크플로를 접수합니다. 단일 앱의 필요한 정보가 충분하면 자동으로 진행하고, 부족하면 Analysis 탭에서 질문과 근거를 확인하고 입력하여 재개합니다. 이 버튼은 선택한 브랜치의 이후 푸시에도 분석·계획을 거치는 자동 배포를 켭니다. 파이프라인 접수가 실패하면 서비스를 보존하고 안내합니다. Control API 는 배포 요청을 DB 에 기록하고, 빌드·배포는 Worker 가 합니다. Worker 가 없는 로컬에서는 배포가 Queued 에서 멈춥니다. 진행 중인 배포는 3초마다 다시 불러옵니다.
- 프로젝트와 서비스 삭제는 was 가 소프트 삭제로 처리합니다.
- 세션이 만료돼 API 가 401 을 주면 `/login` 으로 이동합니다.
- localStorage 키 `ll:plan-limit`을 `1`로 두면 업그레이드 한도 상태를 재현하고 Continue 버튼을 사용할 수 있습니다. 키를 지우면 기본 동작으로 돌아갑니다.
- 로그인 여부는 시작할 때 was 의 `GET /api/v1/me` 로 확인합니다. 로그인하지 않았으면 보호된 경로는 `/login` 으로 이동하고, 로그인한 상태로 `/login` 을 열면 대시보드로 이동합니다. 회원가입과 온보딩 흐름은 없습니다.
- Logout은 was 의 `POST /api/v1/auth/logout` 으로 세션 쿠키를 지우고 `/login` 으로 이동합니다.
- 계정 이름과 아바타는 GitHub 계정에서 오지만 워크스페이스 이름, 결제, 워크스페이스 생성은 샘플입니다.

## 검증

- TypeScript 검사와 프로덕션 빌드 통과
- 로컬 was 와 브라우저로 확인: 로그인·로그아웃·세션 만료, 프로젝트·서비스 생성/수정/삭제, 저장소 검색·주소 확인·브랜치, 서비스 설정 저장(DB 반영 확인), 커맨드 팔레트, 없는 프로젝트 안내
- `VITE_API_BASE_URL` 을 닿지 않는 주소로 바꾸면 로그인 화면에 서버 연결 안내가 표시됨

## 분석·계획·배포 통합

WAS `feat/ai-analysis-integration`과 함께 사용합니다. Create와 Deployments의 Analyze & deploy는 `/services/{id}/pipelines`에 `{mode, autoDeploy: true, enableAutoDeploy: true}`를 접수합니다. 분석 탭에서 단독 Analyze only도 사용할 수 있으며, 이 경우 기존 `/analysis` API를 사용합니다.

- 저장소의 고정 commit을 분석하고, 필요한 사용자 입력을 확보한 뒤 분석 에이전트가 계획을 생성합니다. 기존 Dockerfile을 사용하거나 Railpack으로 이미지를 빌드하고 플랫폼 Worker가 배포합니다.
- 단일 앱의 검증된 관측값과 저장된 설정이 충분하면 원클릭으로 진행합니다. 후보·포트·환경 바인딩 등 필수 정보가 부족하면 `AWAITING_INPUT`에서 멈춥니다. 후보와 설정을 확인한 후 Continue to planning & deploy로 재개합니다. 소스의 runtime/role 또는 검증 근거에 대한 code_review는 사용자 설정 입력으로 해결됐다고 처리하지 않습니다.
- AI 모델 미설정 오류를 표시하며 static으로 자동 전환하지 않습니다. 사용자가 Static analysis를 명시적으로 선택할 수 있습니다. 이미 시작된 워크플로의 mode는 새로고침 후에도 표시됩니다.
- 진행 중 작업은 3초마다, 대기·종료 작업은 10초마다 서버 상태를 읽습니다. 새로고침해도 서버에 저장된 진행 상태를 복원합니다. 빌드·배포 전에는 취소할 수 있으며 Worker 실행이 시작된 후에는 취소 버튼이 비활성화됩니다.
- 기존 detected/suggested/unknown 결과, 질문·한계, 마스킹된 원문 근거와 의미 검증 결과를 유지합니다. 단독 분석에서 추천은 명시 확인 후 저장하며, 복수 후보의 첫 항목을 임의 선택하지 않습니다.
- 부족한 환경 바인딩은 `{key, value}`의 공개 설정 또는 `{key, secretRef, secretKey}`의 기존 Kubernetes Secret 참조로 입력합니다. 민감한 키는 공개 값으로 제출할 수 없습니다. Secret은 인프라 담당자가 서비스 namespace에 먼저 생성해야 합니다. 이 폼은 실제 비밀값을 받거나 브라우저 저장소에 저장하지 않습니다. 기존 Variables 탭은 아직 브라우저 샘플이므로 배포 바인딩을 저장하지 않습니다.
- Build & deployment plan에서 Worker가 사용할 builder·root·port·commands와 plan digest를 표시합니다. 별도의 portable infrastructure dossier는 신규 인프라 바인딩/실행 검증이 미완료면 blocked일 수 있으며, 기존 타깃에 전달하는 Worker 계획과 함께 구분하여 제공합니다.
- 배포가 실패하면 Details의 Failure log diagnosis에서 해당 실행 회차의 수집된 마스킹 로그를 진단합니다. WAS의 자동 진단 작업도 같은 조회로 표시합니다. 관찰 사실·근거·원인 후보·불확실성·다음 확인·누락 정보를 구분하고, remediation v2의 적용 조건·수정 템플릿·검증·rollback·risks를 제안으로 표시합니다. 진단과 수정 제안은 원래 배포 상태를 바꾸거나 자동으로 수정을 실행하지 않습니다.

검증: `npm run typecheck`, `npm test`, `npm run build`. 23개 테스트로 기존 분석 계약, 원클릭 승인 범위·세션·명시 static 선택·환경 참조 검증·실패 단계·실행 회차별 로그 진단 API를 검사합니다. 로컬 통제된 API fixture로 분석→포트/Secret 참조 질문→계획→빌드→배포 실패→로그 진단 화면과 새로고침 복원을 확인합니다. 유료 모델이나 실제 클라우드 배포는 실행하지 않습니다.

1002 변경과 현재 설계: [docs/1002-integration-design.md](docs/1002-integration-design.md).

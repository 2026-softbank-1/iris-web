# LikeLion dashboard frontend

React + TypeScript + Vite로 구현한 LikeLion 다크 대시보드 프론트엔드입니다. 로그인만 API 서버(was)의 GitHub 로그인에 연결되어 있고, 나머지 데이터는 샘플입니다.

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

- 로그인: GitHub로 시작하기 (was 연동, 세션 쿠키), Logout
- Workspace: 프로젝트 카드/리스트, 정렬, 즐겨찾기, Templates, Settings
- 프로젝트: React Flow 캔버스, 서비스 노드, 패닝/확대/축소
- 서비스: Deployments, Variables, Metrics, Console, Settings
- 배포: Details, Build/Deploy/Network Logs, 검색, 단계 펼치기
- 오류 프로젝트: offline 상태, removed 배포 기록, SESSION_SECRET 길이 검증 Zod 오류 로그
- 프로젝트 Logs, Observability, Sandboxes, Settings
- 커맨드 팔레트, 업그레이드 다이얼로그, 메뉴와 드로어

MVP 범위 밖이라 뺀 항목: 워크스페이스 People, 프로젝트 Members, 외부 문서 링크.
워크스페이스 Usage는 코드만 남겨 두고 연결을 주석 처리했습니다.

## 제한 사항

실제 배포, 결제, 초대, 계정 관리 및 서버 설정 저장은 하지 않습니다. 일부 버튼은 안내만 표시하며 일부 보조 설정 화면은 간소화되어 있습니다. 로그, 사용량 및 지표는 정적/샘플 데이터입니다.

주요 데스크톱 화면을 기준으로 맞췄습니다. 로고와 장식 그림은 자체 구현입니다. GitHub avatar에는 외부 네트워크가 필요합니다.

## 구조

- `src/data/mock.ts`: 사용자/워크스페이스, 프로젝트, 서비스, 배포 및 로그 샘플
- `src/layouts`: Workspace/Project 공통 레이아웃
- `src/pages`: 페이지와 서비스/배포 패널
- `src/components`: 공통 UI, 커맨드 팔레트, 다이얼로그
- `src/styles`: 디자인 토큰 및 화면별 CSS

`mock.ts`에는 이름, 이메일 및 리포지터리 샘플 메타데이터가 있습니다. 외부 공개 전에 실제 값으로 교체하거나 지우세요. 실제 비밀번호나 인증 토큰은 필요하지 않습니다.

## 로컬 시뮬레이션 동작

- Dashboard New, 커맨드 팔레트 New Project, 프로젝트 Add는 Create 흐름을 엽니다. 선택할 수 있는 항목은 GitHub Repository뿐이고 나머지는 Coming soon으로 표시됩니다. Region은 Asia East 2만 선택할 수 있습니다.
- GitHub 샘플 리포지터리는 검색, URL 검증, 리뷰, 시뮬레이션 배포, 로그, 새로고침 후 유지를 지원합니다. 실제 리포지터리를 가져오거나 배포하지 않습니다.
- localStorage 키 `ll:plan-limit`을 `1`로 두면 업그레이드 한도 상태를 재현하고 Continue 버튼을 사용할 수 있습니다. 키를 지우면 기본 동작으로 돌아갑니다.
- 로그인 여부는 시작할 때 was 의 `GET /api/v1/me` 로 확인합니다. 로그인하지 않았으면 보호된 경로는 `/login` 으로 이동하고, 로그인한 상태로 `/login` 을 열면 대시보드로 이동합니다. 회원가입과 온보딩 흐름은 없습니다.
- Logout은 was 의 `POST /api/v1/auth/logout` 으로 세션 쿠키를 지우고 `/login` 으로 이동합니다.
- 계정 이름과 아바타는 GitHub 계정에서 오지만 워크스페이스 이름, 결제, 워크스페이스 생성은 샘플입니다.

## 검증

- TypeScript 검사 통과
- 프로덕션 빌드 통과
- 브라우저에서 로그인, 대시보드, Create 흐름, 서비스 패널 및 removed 배포 오류 로그 확인

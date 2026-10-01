# LikeLion dashboard frontend

React + TypeScript + Vite로 구현한 LikeLion 다크 대시보드 프론트엔드입니다. 실제 계정/API에는 연결하지 않습니다.

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

- 로그인: GitHub로 시작하기 (로컬 시뮬레이션)
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
- Logout은 `/login`으로 이동하고, 새로고침 후에도 보호된 경로는 막힙니다. `/login`은 GitHub만 지원하며 누르면 바로 대시보드로 이동합니다. 회원가입과 온보딩 흐름은 없습니다.
- 로그인은 로컬 시뮬레이션입니다. 실제 GitHub OAuth, 결제, 워크스페이스 생성은 없습니다.

## 검증

- TypeScript 검사 통과
- 프로덕션 빌드 통과
- 브라우저에서 로그인, 대시보드, Create 흐름, 서비스 패널 및 removed 배포 오류 로그 확인

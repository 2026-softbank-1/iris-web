# 화면별 구현과 동작

README 에서 옮긴 상세다. 엔드포인트는 모두 was 의 `/api/v1` 아래다.

## 화면 ↔ 엔드포인트

| 화면 | 엔드포인트 |
|---|---|
| 로그인·로그아웃·계정 | `GET /auth/github`, `POST /auth/logout`, `GET /me` |
| Dashboard 프로젝트 목록 | `GET /projects`, `GET /projects/{id}/services` |
| Create → 프로젝트 만들기 | `POST /projects` |
| Create → 저장소 검색·주소 확인 | `GET /github/repos`, `GET /github/repos/resolve`, `GET /github/installations` |
| Create → 브랜치·배포 대상 | `GET /github/repos/{owner}/{repo}/branches`, `GET /targets` |
| Create → 서비스 만들기 | `POST /projects/{id}/services` |
| Create → 레포 구성 확인(분석 게이트) | `POST /projects/{id}/repository-analyses`, `GET /projects/{id}/repository-analyses/{analysisId}`, `POST …/{analysisId}/apply` |
| Configure GitHub App | `GET /github/install` |
| 프로젝트 Settings 이름·설명, Danger | `GET·PATCH·DELETE /projects/{id}` |
| 서비스 Settings (이름, 루트 디렉터리, 브랜치, 자동 배포, 포트, 배포 대상, 빌더, 빌드·시작 명령), Danger | `GET·PATCH·DELETE /services/{id}` |
| Create 의 Deploy(첫 배포), Deploy·Redeploy·Restart·Rollback 버튼 | `POST /services/{id}/deployments` |
| Deployments 탭, Activity 드로어 | `GET /services/{id}/deployments` |
| 배포 패널 Details(상태 이력, 소스, 구성, 대체한 배포) | `GET /services/{id}/deployments/{deploymentId}` |
| 배포 패널 Build Logs | `GET /services/{id}/deployments/{deploymentId}/build-logs` |
| 배포 패널 Deploy Logs | `GET /services/{id}/deployments/{deploymentId}/deploy-logs` |
| 배포 패널 Network Logs | `GET /services/{id}/deployments/{deploymentId}/network-logs` |
| 서비스 공개 주소(캔버스 노드, 서비스 패널 상단, Settings 의 Public Networking) | `GET /services/{id}/domains` |
| 프로젝트 Logs (기간만큼 과거 로그를 받고, 이어서 실시간) | `GET /services/{id}/logs`, `GET /services/{id}/logs/stream` (SSE) |
| 서비스 Metrics 탭 (CPU, Memory) | `GET /services/{id}/metrics` |
| 서비스 Metrics 탭 (Public Network Traffic, Requests, Request Error Rate, Response Time) | `GET /services/{id}/traffic-metrics` |
| 서비스 Settings 의 Scale (Replica 수, CPU·메모리 한도) | `GET·PUT /services/{id}/scaling` |
| 서비스 Settings 의 Deploy 배포 방식 (롤링·카나리·블루그린) | `PATCH /services/{id}` 의 `deploymentStrategy` |
| 서비스 Variables 탭 (추가·수정·삭제, Raw Editor, Likelion 이 넣는 변수) | `GET·POST·PUT /services/{id}/variables`, `PUT·DELETE /services/{id}/variables/{key}` |
| 배포 패널 AI 진단 탭 (실패한 배포의 원인·해결책) | `GET /services/{id}/deployments/{deploymentId}/diagnosis`, `POST …/diagnose[?refresh=true]` |
| AI 수정·재배포 (배포 행·실패 배너·AI 진단 탭) | `POST /services/{id}/deployments/{deploymentId}/auto-repair`, `GET …/repairs/latest?diagnosisId=`, `GET·POST /services/{id}/repairs/{repairId}[/auto]`, `GET /services/{id}/repair-access`, `GET /services/{id}/repairs/{repairId}/artifacts/{name}` |

웹훅(`POST /webhooks/github`)은 GitHub 가 was 를 호출하는 용도라서 웹에서는 쓰지 않습니다.

프로젝트 Logs 는 서비스마다 첫 번째 배포 대상(`targetIds[0]`)의 런타임 로그를 보여줍니다. was 에 `LOKI_URL` 이 설정돼 있지 않으면 `NOT_CONFIGURED` 오류가 납니다. 서버가 5분마다 스트림을 끊으면 브라우저가 `Last-Event-ID` 로 이어 붙고, 한 번에 받을 양을 넘으면(`overflow`) 과거 로그 조회로 따라잡습니다. 스택 트레이스처럼 앞 줄에 이어지는 줄(공백으로 시작하는 줄, `Caused by:`)은 같은 pod 의 앞 줄과 한 행으로 묶어 보여줍니다. 레벨은 was 가 주지 않아서 본문의 `ERROR`, `level=warn` 같은 표기와 줄 맨 앞의 `npm error`, `SyntaxError:` 같은 표기로 추정합니다.

서비스 Metrics 탭은 서비스의 첫 번째 배포 대상(`targetIds[0]`)의 CPU·Memory 지표(`/metrics`)를 보여줍니다. 시간 범위마다 조회 간격(`step`)이 정해져 있고(15분 30초, 1시간·6시간 60초, 1일 120초, 7일 600초), 끝(`end`)은 지금보다 30초 앞입니다. Live 가 켜져 있으면 30초마다 다시 받고 Pause 하면 멈춥니다. 범례의 `Sum` 은 합계 한 줄, `Replicas` 는 Pod 마다 한 줄(`groupBy=pod`, 켠 카드가 있을 때만 추가로 조회)입니다. Pod 이 50개를 넘으면 서버가 422 를 주므로 안내를 보여줍니다. `groupBy` 를 모르는 was 는 쿼리를 무시하고 합계만 돌려주는데, 이때는 오류로 보지 않고 합계 한 줄로 그리며 Replicas 는 비활성처럼 보입니다.

Public Network Traffic·Requests·Request Error Rate·Response Time 은 ALB 접근 로그 기반 지표(`/traffic-metrics`)입니다. `/metrics` 와 요청·로딩·오류 상태가 따로라서 한쪽이 실패해도 다른 쪽 차트는 그대로 그려집니다. Pod 전체 네트워크(`/metrics` 의 `network_*`)는 더 이상 쓰지 않습니다.

- 이 API 는 `step` 이 60초 이상이어야 해서 15분·1시간·6시간 60초, 1일 120초, 7일 600초입니다. 요청 수는 `step` 길이 버킷의 합계라서 범례에 분당·2분당·10분당으로 적습니다.
- 요청이 없는 분에는 점이 없습니다. 0 으로 채우거나 점을 이어 붙이지 않고 선을 끊습니다.
- 지표가 약 15분 늦게 집계됩니다. 응답의 `availableUntil` 이후는 비어 있는 것이 아니라 '집계 대기'입니다. 보이는 범위가 전부 대기이면(Last 15 min) 안내를 보이고, 일부만 대기이면 그 구간을 옅게 칠하고 '집계 대기'라고 표시합니다. 그래서 처음 열 때의 기본 범위는 Last 1 hour 입니다.
- 요청 오류율은 5xx·4xx 두 줄(축은 %), 응답 시간은 p50·p95 두 줄(축은 ms·s, 평균은 그리지 않음)입니다. 응답 시간은 5분 구간 값이라 받은 점을 그대로 그리고 합치지 않습니다.
- 이 API 가 아직 없는 was 는 404 를 주는데, 오류로 보지 않고 '지표가 없어요' 빈 상태로 둡니다. API 가 나가면 다음 조회부터 자동으로 동작합니다.

서비스 Settings 의 Scale 은 was 가 저장한 **원하는** 설정(Replica 수, Pod 하나의 CPU·메모리 limits)을 보여 주고, 실제로 떠 있는 Pod 수나 적용 완료를 뜻하지는 않습니다. 슬라이더는 정해진 칸(CPU 0.25·0.5·1·2 vCPU, 메모리 256 MiB~4 GiB)에서 고르고, was 에 이미 다른 값이 저장돼 있으면 그 값도 칸으로 보여 줍니다. 적용(PUT)은 Pod 이 새로 시작되는 RESTART 배포를 만드니 값을 고칠 때마다 보내지 않고 Apply 를 눌러야 보냅니다. requests 는 화면에서 고치지 않고 저장된 값을 그대로 보내되, 새 limits 보다 크면 limits 로 낮춥니다. 배포가 진행 중이면 Apply 를 막고, 성공한 배포가 없으면 서버가 409 를 줍니다. CPU 최대 2 vCPU 는 iris-infra 노드(`m7i-flex.large`, 2 vCPU·8 GiB)의 크기에 맞춘 값입니다. Replica 는 0~10이고 0 이면 요청을 처리하지 못합니다.

서비스 Settings 의 Deploy 에서 배포 방식(롤링·카나리·블루그린)을 고르면 바로 `PATCH /services/{id}` 로 저장합니다. 저장은 배포를 만들지 않고 다음 배포부터 쓰입니다. 온프레미스(`ONPREM`) 타깃 서비스는 롤링만 고를 수 있습니다. 카나리·블루그린은 Scale 의 **저장된** Replica(편집 중인 값이 아니라 `GET /scaling` 응답)가 2개 이상일 때만 고를 수 있고, 서버도 그보다 적거나 기능을 아직 켜지 않았으면 422 `INVALID_INPUT`(`details[].field = deploymentStrategy`)로 거절합니다. 카나리·블루그린으로 저장된 서비스에서 Replica 를 2개 미만으로 Apply 하려 하면 롤링으로 대체된다는 확인 창을 먼저 띄우고, 취소하면 적용하지 않습니다. 배포 요청은 요청 방식(`requestedDeploymentStrategy`)과 실제 방식(`deploymentStrategy`)을 갖고, 배포 상세의 Deploy 구성에 실제 방식을, 둘이 다르면 롤링으로 대체됐다는 안내를 보여 줍니다. 목록 행에는 롤링이 아닐 때만 방식 이름을 붙입니다. `deploymentStrategy` 를 주지 않는 was(구버전)는 롤링으로 보고, 배포 방식 도입 전 요청에는 표시하지 않습니다. mock(`VITE_MOCK_API=1`)의 `web` 은 카나리·Replica 2, softbank-iris 의 `gateway` 는 블루그린·Replica 1(진행 중 배포가 롤링으로 대체됨)입니다.

서비스 Variables 탭은 was 가 저장한 환경변수를 보여 주고 고칩니다. 값은 소유자에게 평문으로 오므로 눈(보기)·복사 버튼이 그대로 동작하고, 화면은 값을 콘솔에 찍거나 오류에 싣지 않습니다. **변수를 바꿔도 실행 중인 앱은 그대로**이고, 다음 배포(Deploy·Redeploy)나 Restart 부터 그 시점의 변수가 반영됩니다. Rollback 은 그 배포 당시의 변수를 되돌리니, 롤백 직후에는 이 탭의 현재 값과 실행 중인 값이 다를 수 있습니다. 변수 하나는 `POST`(이미 있으면 409 `VARIABLE_CONFLICT`)·`PUT /{key}`·`DELETE /{key}`(없으면 404 `VARIABLE_NOT_FOUND`)로 바꾸고, Raw Editor 는 서버 응답의 변수를 `KEY="값"` 줄로 채워 보여 주다가 저장하면 텍스트 그대로 `PUT /variables {raw}` 로 보냅니다. 이 호출은 변수 **전체를 교체**해서 텍스트에 없는 변수는 지워지고(편집기에 안내가 있습니다), 파싱과 검증은 서버가 합니다. 형식이 틀린 줄이 있으면 422 `INVALID_INPUT` 이고 아무것도 바뀌지 않으며 응답에 줄 번호는 없습니다. 서버 규칙은 키가 영문·숫자·밑줄(숫자로 시작 불가, 128자 이하), `PORT`·`IRIS_` 로 시작하는 이름은 예약, 서비스당 100개, 값 32KiB 이하이고 빈 값은 허용합니다. 서버에 암호화 키가 없으면 503 `NOT_CONFIGURED` 입니다. 하단의 "variables added by LikeLion" 은 응답의 `systemVariables`(이름·설명, 서비스만으로 정해지는 변수는 값도)입니다.

**AI 진단**은 실패한 배포(`FAILED`·`ROLLED_BACK`·`MANUAL_INTERVENTION`, 서비스를 내리는 REMOVE 요청은 제외)를 에러 진단 에이전트로 분석해 원인과 해결책을 보여 줍니다. 서버는 해결책을 **제안만** 하고 실행하지 않으며 배포 상태도 바뀌지 않습니다(was `docs/diagnosis-api.md`). 진단은 서버(was)가 배포의 실패를 확정한 직후(10분 안, `updated_at` 기준)에 스스로 시작하므로 사용자가 누를 필요가 없습니다. 결과를 보는 길은 배포 행의 `⋮` 메뉴, 배포 패널의 `AI 진단` 탭, 서비스 Deployments 탭의 실패 배너 아래 세 곳이고(진단할 수 없는 배포에는 탭이 없고 `/diagnosis` 주소도 Details 로 갑니다), Details 에는 진단 버튼을 두지 않습니다. 실패 배너는 가장 최근 배포가 진단할 수 있는 실패(REMOVE 가 아닌 `FAILED`·`ROLLED_BACK`·`MANUAL_INTERVENTION`)일 때 아래로 확장돼서, 그 배포의 진단 요약(요약 · 가장 앞의 원인과 해결책 하나씩, 나머지는 `외 N개`)과 두 버튼을 보여 줍니다: `AI 진단 상세보기` 는 그 배포의 AI 진단 페이지로 가고, `AI 수정·재배포` 는 `POST …/auto-repair` 로 수정 작업을 요청합니다(아래 AI 수정 참고). 진단 상태(없음·진행 중·멈춤·실패·성공)는 AI 진단 탭과 같은 훅으로 받습니다. 열면 `GET …/diagnosis` 로 가장 최근 진단을 받습니다: 404 `DIAGNOSIS_NOT_FOUND` 면 아직 진단이 없다는 안내입니다. 실패한 지 10분(서버의 자동 진단 창, 시계 차이를 위해 1분 더) 안이면 "곧 자동으로 시작돼요"만 보이고 10초마다 다시 확인해서 서버가 시작한 진단을 알아챕니다. 그보다 오래된 실패는 서버가 진단하지 않으므로 `AI 진단` 버튼으로 직접 시작합니다(백필 없음). `RUNNING` 이면 진행 표시, `SUCCEEDED` 면 결과, `FAILED` 면 이유와 `다시 시도`입니다. 진단이 시작되면(서버가 자동으로, 또는 `AI 진단`·`다시 시도`·`다시 진단`·`다시 시작` 버튼이 `POST …/diagnose` 로, 202 `RUNNING`) `GET` 을 2.5초마다 받다가 `SUCCEEDED`·`FAILED` 가 되면 멈춥니다. 화면을 떠나면(언마운트·다른 배포로 이동) 폴링과 진행 중인 조회를 취소하지만 서버의 진단은 계속되니, 탭을 닫았다 다시 열면 이어서 봅니다. 이미 성공한 진단이 있으면 `POST` 도 200 으로 그 결과를 줘서 다시 돌리지 않고, `다시 진단`은 확인 창을 거친 뒤에만 `?refresh=true` 로 보냅니다(모델 비용이 듭니다). `다시 시도`는 직전 시작과 같은 방식으로 보내서, 확인을 거친 refresh 의 재시도만 refresh 를 이어 쓰고 새로 연 화면의 재시도는 그렇지 않습니다. `RUNNING` 이 4분(서버 시각 `createdAt` 기준)을 넘으면 서버가 죽은 것으로 보고 폴링을 멈춘 채 `다시 시작`을 줍니다(`POST` 하면 서버가 낡은 진단을 닫고 새로 시작합니다). 진행 중에 조회가 연달아 3번 실패하면 폴링을 멈추고 `다시 시도`를 줍니다.

결과는 요약 · 원인 · 해결책 · 더 확인할 것 · 더 필요한 정보 · 근거 로그 · 한계 순입니다. 원인에는 확신 정도(`direct` 로그에 직접 나옴 / `supported` 근거로 추정)와 불확실한 점이 붙고, 해결책은 적용 조건 · 수정 예시 · 확인 방법 · 되돌리기 · 주의로 나눕니다. 수정 예시(`changes[].snippet`)는 **템플릿**이라 `{{NAME}}` 자리표시자를 눈에 띄게 하고 "채워서 쓰세요" 안내와 채울 값 목록을 같이 보여 주며, 복사 버튼은 템플릿 그대로 복사합니다(`targetKnown` 이 false 면 대상이 로그에서 확인되지 않았다고 알립니다). 근거 로그(`evidence[]`, 서버가 비밀값 패턴을 가린 줄)는 기본 접혀 있고, 원인·해결책의 근거 ID 를 누르면 펴지면서 그 줄이 강조됩니다(결과에 없는 ID 는 눌러지지 않게 흐리게 보입니다). `analysisStatus` 가 `insufficient_evidence`·`no_failure_evidence` 인 정상 응답은 원인·해결책이 비어 있어도 이유를 설명하는 안내를 보여 주고, 서버가 값이 없는 필드를 응답에서 빼므로 모든 배열은 없어도 그립니다. `errorCode` 는 코드를 그대로 노출하지 않고 문장으로 바꿉니다(`DIAGNOSIS_LOGS_UNAVAILABLE` 은 빌드·배포 로그 탭으로, 나머지는 다시 시도로 안내하고, 모르는 코드는 다시 시도로 받습니다). 진단 내용(요약·원인·해결책·근거)은 서버가 한국어로 주므로 일본어·영어 화면에서도 번역하지 않습니다. mock(`VITE_MOCK_API=1`)에는 시나리오를 넣어 두었습니다: 프로젝트 likelion-web 의 `web` 서비스에서 `feat: 대시보드 차트`(오래된 실패라 진단 없음 → `AI 진단` 버튼 → 진행 중 → 성공)와 `fix: 차트 빌드 오류 수정`(이미 성공한 진단), `sandbox` 서비스(프로젝트 playground)는 가장 최근 배포가 실패했고 성공한 진단이 있어 실패 배너 아래에 진단 요약이 보입니다. `worker` 서비스에서 `refactor: 재시도 정책`(3분 전 실패라 mock 이 4초 뒤 자동 시작한 것처럼 행동하고, 시작할 때마다 다른 오류로 실패. dev 서버를 켠 지 10분이 지나면 오래된 실패로 바뀝니다)·`chore: 의존성 정리`(근거 부족)·`fix: 헬스체크 경로 변경`(실패 흔적 없음), softbank-iris 의 `docs` 서비스에서 `docs: 배포 파이프라인 정리`(멈춘 진단)입니다.

**레포 구성 확인(분석 게이트)**은 Create 의 GitHub 저장소 경로에서 배포 검토 다음 단계다. 검토의 기본 버튼 `레포 구성 확인`이 `POST /projects/{id}/repository-analyses`(`sourceRepositoryUrl`·`githubInstallationId`·`sourceBranch`·`rootDirectory`·`mode=auto`)로 분석을 맡기고, `GET …/{analysisId}` 를 1.5초마다 최대 3분 받는다(창을 닫거나 뒤로 가면 폴링과 진행 중 조회를 취소한다). 새 프로젝트로 만들 때는 분석이 프로젝트 아래에서 돌기 때문에 확인을 시작하면서 프로젝트를 먼저 만들고, 서비스를 하나도 만들지 않고 창을 닫거나 검토로 돌아가면 그 빈 프로젝트를 지운다. 결과는 세 가지다. `decision=skip` 이면 "단순 단일 이미지 — AI 분석 생략" 과 이유·빌더를 보여 주고 `배포`가 기존 `POST /services` 에 `analysisId` 를 붙여 서비스 하나를 만든 뒤 첫 배포를 요청한다(`그래도 AI 분석 실행`은 `mode=force` 로 다시 분석). `decision=analyze` 면 "멀티 이미지·복합 레포 감지 — AI Code Analyzer 활성화" 와 이유, 배포 단위 표(선택·이름·루트·빌더·Dockerfile·포트 편집, 역할·변수 키·의존), DB·Redis 는 플랫폼이 만들지 않는다는 안내, 확인이 필요한 항목을 보여 주고 `N개 서비스 생성 및 배포`가 `POST …/apply`(`units`·`deploy: true`·`targetIds`)를 보낸 뒤 프로젝트 캔버스로 간다. `FAILED`·시작 거절·조회 3회 연속 실패·3분 초과면 오류와 `분석 없이 단일 서비스로 생성`(분석 전과 같은 경로)을 준다. 검토의 `확인 없이 바로 배포`도 분석 전과 같은 경로다. 분석 결과의 `reasons`·`questions` 문장은 분석기가 만든 한국어라 번역하지 않는다. 서비스 응답의 `analysisGate` 가 있으면 서비스 패널 제목 옆과 Settings 의 Source 에 `AI 분석 생략` / `분석으로 생성됨 · unit` 배지를 단다. mock(`VITE_MOCK_API=1`)에는 `kylo-dev/single-app`(skip, force 면 unit 1개), `kylo-dev/multi-image-shop`(web·api·worker + postgres·redis), `kylo-dev/broken-repo`(FAILED `ANALYZER_FAILED`) 저장소가 있고, 분석은 접수 뒤 약 3초에 끝난다.

**멀티 이미지 스택·관리형 DB·환경변수 검증**은 한 프로젝트가 여러 이미지를 반복해서 배포하는 흐름이다. 분석 apply 단계는 `dependencies[]` 마다 `플랫폼이 개발용 DB 자동 생성`(기본 켜짐, `other` 엔진·온프레미스 타깃은 꺼짐과 이유) 토글과 DB 서비스 이름을 두고, `POST …/apply` 에 `dependencies: [{dependencyId, provision, name?}]` 를 보낸다(응답의 `databases` 는 토스트 문구에 센다). unit 의 `env[].binding` 은 `DATABASE_URL ← postgres.url 자동 연결`, `hostAliases[]` 는 `api:8000 → api 서비스` 로 미리 보여 준다. 만들고 나면 서비스 응답의 `stack` 으로 캔버스가 스택을 그룹 상자로 묶고(`GET /projects/{id}/stacks`, 진행 중이면 3초·아니면 10초 폴링) 배포 순서(1 DB → 2 api/worker → 3 web)와 의존 화살표, 단계별 진행·보류 사유(`status=HELD`, `heldBy`)를 보여 주며, `스택 전체 재배포`는 `POST …/stacks/{stackId}/deployments` 를 부른다. 스택의 `pendingChanges` 가 있으면 `레포 구성 변경 감지` 배너가 뜨고 `변경 보기` 가 `pendingChanges.analysisId` 의 분석을 받아 diff(`UNIT_ADDED`·`UNIT_REMOVED`·`UNIT_CHANGED`·`DEPENDENCY_ADDED`·`DEPENDENCY_REMOVED`)를 보여 준 뒤 같은 분석을 apply 한다(증분: 기존 서비스는 이름을 그대로 보내 unitId 로 맞추고, 새 의존성만 provision). 캔버스 `생성` → `데이터베이스`(엔진·이름·저장 공간 1–20 GiB, 만든 뒤 변경 불가)는 `POST /projects/{id}/databases` 다. `kind=DATABASE` 서비스는 `연결 정보` 탭(내부 주소 `internalHost`·`internalPort`, 마스킹된 `connection.urlTemplate`, 속성 목록, 데모용·삭제 시 데이터 소실·백업 없음 경고)이 첫 탭이고 콘솔·빌드 로그·네트워크 탭과 앱 설정은 숨긴다. Variables 탭은 `reference: {serviceId, property}` 변수(`참조 변수` 버튼, `← postgres.url`)를 만들고, `GET /services/{id}/variables/validation` 의 `issues[]`(`REQUIRED_MISSING`·`LOCALHOST_ADDRESS`·`UNRESOLVABLE_HOST`·`SCHEME_MISMATCH`·`REFERENCE_BROKEN`)를 error/warning 패널로 보여 주며 `suggestion.reference` 는 `연결하기` 한 번으로 적용한다. 배포·재배포·재시작·스택 재배포가 `422 VARIABLES_INVALID`(`data.issues`)로 거절되면 이슈를 배포 탭이나 대화상자에 보여 주고 변수 탭으로 안내한다. mock 에는 `multi-image-shop`(postgres·redis 가 만들어진 스택, 구성 변경 감지 대기 중), `shop-validation`(검증 실패), `shop-stack-failing`(api 실패·web 보류) 프로젝트가 있다.

**배포 패널의 Details와 로그 탭**은 배포 상세 `GET /services/{id}/deployments/{deploymentId}` 와 그 아래 `build-logs`·`deploy-logs`·`network-logs` 를 씁니다(was `docs/deployment-details-api.md`). 상세 응답은 패널이 한 번 받아서 Details·Deploy Logs·Network Logs 가 같이 쓰고(진행 중이면 3초마다 다시 받습니다), Details 는 `source`(저장소·브랜치), `configuration`(Configuration Pretty 의 빌더·루트 디렉터리·빌드 명령어 / 대상·포트·시작 명령어, `builder` 가 없으면 Auto-detect)과 `replacedBy`(상태 배너 아래에 `대체한 배포 #id` 링크와 시각)로 그립니다. `configuration` 의 값은 **배포 시점이 아니라 서비스의 지금 설정**이고, 응답을 받기 전에는 서비스의 지금 설정으로 채웁니다. `build`·`releases` 는 Code 보기에서 응답 JSON 그대로 볼 수 있습니다.

Build Logs 는 처음부터 1000줄씩 `nextCursor` 로 이어 읽습니다. 끝난 빌드는 쉬지 않고 읽다가 서버가 `isComplete`(읽은 줄이 없는 응답)를 주면 멈추고, 진행 중인 빌드는 3초마다 새 로그를 기다립니다(숨은 탭에서는 요청하지 않고, 배포가 끝났는데 빌드가 시작하지 않았으면 멈춥니다). 롤백·재시작은 새로 빌드하지 않아서 `loggedDeploymentId` 가 이 배포가 아니면 원본 배포의 로그라는 안내와 그 배포의 Build Logs 로 가는 링크를 보여 주고, `isPartial` 이면 앞부분이 빠졌다는 안내를, 10,000줄에서는 읽기를 멈췄다는 안내를 보여 줍니다. CodeBuild 줄은 `[Container]` 앞머리까지 그대로 보여 주고 레벨은 본문으로 추정합니다. 검색창은 읽어 온 줄에서 거르고, 다운로드는 읽어 온 줄을 `build-logs-{서비스}-{배포}.txt` 로 내려받습니다(서버 다운로드 API 는 없습니다). 같은 시각(`timestampNs`)의 줄이 여럿이라 행의 키는 순번입니다.

Deploy Logs 는 이 배포의 release 가 붙은 앱 컨테이너 로그를 최근 1000줄까지(시간 오름차순) 받아서, 프로젝트 Logs 와 같은 규칙으로 레벨을 추정하고 스택 트레이스를 한 행으로 묶습니다. pod 이 둘 이상이면 `pod` 속성이 붙습니다. 1000줄을 넘으면 최근 줄만 보인다고 알립니다(서버의 `search` 는 대소문자를 구분해서 쓰지 않고, 검색창은 받아 온 줄에서 거릅니다). 배포가 진행 중이면 5초마다 다시 받고, 새로고침 버튼으로 직접 받을 수도 있습니다. Network Logs 는 ALB 접근 로그라서 **URL·메서드·IP 는 없고** 시각·상태·서비스 응답(`targetStatus`)·수신·송신 바이트·응답 시간만 열로 보여 줍니다(응답 시간은 ALB 가 서비스에 요청을 보내고 응답 헤더를 받기까지라서 사용자가 느낀 시간이 아닙니다). `2xx`~`5xx` 버튼은 서버의 `statusClass` 로 거르고 검색창은 받아 온 줄을 상태 코드로 거릅니다. ALB 가 로그를 5분 안팎으로 늦게 올리므로 자동으로 다시 받지 않고(새로고침 버튼) 빈 상태 문구에 그 지연을 적었습니다. 두 탭 모두 배포가 반영한 타깃이 둘 이상이면 로그 위에 타깃 선택이 생기고(`targetId`), 성공하지 못한 배포나 release 가 없는 배포는 빈 응답이라 `아직 로그를 볼 수 없어요` 빈 상태로 보입니다. 로그 오류는 코드(`404`·`422`·`502`·`503`)별 문장과 `다시 시도`로 보여 줍니다. mock(`VITE_MOCK_API=1`)에는 롤백(원본 배포의 빌드 로그)·하루 지난 빌드 실패(`isPartial`)·진행 중인 빌드(새 배포를 만들면 줄이 늘어납니다)·두 타깃 서비스(softbank-iris 의 `gateway`) 시나리오가 있습니다.

**AI 수정**은 진단할 수 있는 실패 배포에서 `AI 수정·재배포` 버튼(배포 행·배포 패널·실패 배너·AI 진단 탭)으로 시작한다. `POST …/auto-repair`(Idempotency-Key)로 요청하고, 진행 중인 작업이 있으면 `POST /repairs/{id}/auto` 로 이어 가며, 끝날 때까지 `GET /repairs/{id}` 를 2.5초마다 받는다. AI 진단 탭은 `repairs/latest`·`repair-access`(GitHub App 권한)·`artifacts`(패치)로 결과와 권한 안내를 보여 준다. 환경변수 값이 필요한 실패(`CONFIGURATION_VALUES_REQUIRED` 또는 진단이 사람 조치를 요구)는 AI 수정을 끄고 Variables 이동과 수동 재배포(`POST /deployments`, MANUAL)를 안내한다. 자동 머지·재배포 여부는 서버 응답(`autoMerge`·`autoRedeploy`)을 따른다. mock(`VITE_MOCK_API=1`)에는 AI 수정 시나리오가 없다.

- Workspace: 프로젝트 카드/리스트, 정렬, 즐겨찾기(브라우저에 저장), Templates, Settings
- 프로젝트: React Flow 캔버스, 서비스 노드, 패닝/확대/축소
- 서비스: Deployments, Variables, Metrics, Console, Settings
- 배포: Details, Build/Deploy/Network Logs(검색, 다운로드, 상태 코드 필터)
- 프로젝트 Logs, Observability, Sandboxes
- 커맨드 팔레트, 업그레이드 다이얼로그, 메뉴와 드로어

`/traffic-metrics` 가 prod 의 was 에 나가기 전에는 Public Network Traffic·Requests·Request Error Rate·Response Time 카드가 '지표가 없어요' 빈 상태입니다.

MVP 범위 밖이라 뺀 항목: 워크스페이스 People, 프로젝트 Members, 외부 문서 링크.
워크스페이스 Usage는 코드만 남겨 두고 연결을 주석 처리했습니다.

## 제한 사항

결제, 초대, 계정 관리는 하지 않습니다. 일부 버튼은 안내만 표시하며 일부 보조 설정 화면은 간소화되어 있습니다. 사용량은 정적/샘플 데이터입니다.

서비스 상태는 was 가 서비스 응답에 붙여 주는 최근 배포(`latestDeployment`)로 정합니다. 성공·롤백됨은 online, 진행 중(QUEUED·BUILDING·DEPLOYING)은 Deploying, 실패·수동 개입은 crashed 로 표시합니다.

서비스를 클러스터에서 내리는 요청(`triggerType=REMOVE`, was ADR 0016)은 배포가 아니라 이벤트로 보여 줍니다. 가장 최근에 성공한 요청이 REMOVE 면 서비스가 내려간 것이라 Active 배포가 없고(캔버스 `Service is removed`, 도메인은 링크 없이 흐리게, Console·Scale Apply 는 막음), Deployments 에는 `Taken down` 으로 남으며 그 앞의 성공 배포는 대체된 이력(`Removed`)입니다. 다시 올리는 것은 Deploy·Redeploy·Rollback 입니다. REMOVE 가 진행 중이면 앱이 아직 떠 있으니 이전 배포가 Active 로 남고 `Removing` 만 보입니다. FAILED 는 서비스를 건드리기 전에 끝난 것이라 online 그대로 안내만 하고, MANUAL_INTERVENTION 은 상태를 알 수 없어서 crashed 로 보여 주되 앱이 떠 있을 수 있다고 알립니다. REMOVE 를 요청하는 버튼은 없습니다. REMOVE 행에는 Redeploy·Rollback 을 주지 않습니다.

Restart 는 지금 떠 있는(가장 최근에 성공한) 배포의 이미지를 빌드 없이 다시 배포해 Pod 을 새로 시작합니다(`triggerType=RESTART`, `sourceSha`·`sourceDeploymentId` 없이 보냅니다). 서비스 패널 Deployments 탭에서 **Active 배포 행**의 메뉴(Redeploy 아래)에만 있고, 진행 중인 배포가 있거나 서비스가 내려가 Active 행이 없으면 보이지 않습니다. History 행에서 이전 버전으로 되돌리는 것은 Rollback 입니다. 서버가 그래도 409(`DEPLOYMENT_IN_PROGRESS`·`NO_SUCCEEDED_DEPLOYMENT`)를 주면 토스트로 보여 줍니다. 서비스 Settings 의 Scale Apply 도 서버에서 RESTART 배포를 만들며, 그 요청은 이력에 `via Restart` 로 남습니다.

주요 데스크톱 화면을 기준으로 맞췄습니다. 로고와 장식 그림은 자체 구현입니다. GitHub avatar에는 외부 네트워크가 필요합니다.

## 동작

- Dashboard New, 커맨드 팔레트 New Project, 프로젝트 Create는 Create 흐름을 엽니다. 선택할 수 있는 항목은 GitHub Repository뿐이고 나머지는 Coming soon으로 표시됩니다.
- Create 에서는 GitHub App 이 접근할 수 있는 저장소만 보입니다. 저장소가 없으면 `Configure GitHub App` 으로 설치하고, 주소를 붙여넣으면 접근 권한까지 확인합니다. 브랜치와 배포 대상을 고르고(AWS·온프레미스(`ONPREM`) 타깃 중 하나. 그 밖의 종류는 비활성으로 표시) Deploy 를 누르면 프로젝트와 서비스를 만들고 첫 배포(MANUAL)를 요청합니다(서비스 생성이 실패하면 방금 만든 빈 프로젝트를 지우고, 첫 배포 요청만 실패하면 서비스는 남기고 알려 줍니다). Control API 는 배포 요청을 DB 에 기록하고, 빌드·배포는 Worker 가 합니다. Worker 가 없는 로컬에서는 배포가 Queued 에서 멈춥니다. 진행 중인 배포는 3초마다 다시 불러옵니다.
- 프로젝트와 서비스 삭제(`DELETE`, 204)는 was 가 소프트 삭제하면서 떠 있는 앱도 클러스터에서 내립니다. 화면에서는 바로 사라지지만 앱이 내려가는 데 2~3분 걸리고 그동안 공개 주소가 응답할 수 있어서, Danger 설명에 몇 분 걸릴 수 있다고 안내합니다. 앱 내리기가 실패해도 화면에서는 알 수 없으니(서버 로그에만 남음) 즉시 내려간다고 단정하지 않습니다. 진행 중인 배포(QUEUED·BUILDING·DEPLOYING)가 있으면 was 가 아무것도 지우지 않고 409 `DEPLOYMENT_IN_PROGRESS` 를 주고(프로젝트는 소속 서비스 하나라도 진행 중이면 전체가 409), 삭제 화면은 이때 삭제 맥락의 문구("A deployment is in progress. Wait for it to finish, then delete the service.")를 토스트로 보여 주며 서비스·프로젝트를 화면에 그대로 둡니다. Deploy·Restart 등 다른 화면의 공용 오류 문구(`describeError`)는 바꾸지 않았습니다.
- 세션이 만료돼 API 가 401 을 주면 `/login` 으로 이동합니다.
- 로그인 여부는 시작할 때 was 의 `GET /api/v1/me` 로 확인합니다. 로그인하지 않았으면 보호된 경로는 `/login` 으로 이동하고, 로그인한 상태로 `/login` 을 열면 대시보드로 이동합니다. 회원가입과 온보딩 흐름은 없습니다.
- Logout은 was 의 `POST /api/v1/auth/logout` 으로 세션 쿠키를 지우고 `/login` 으로 이동합니다.
- 계정 이름과 아바타는 GitHub 계정에서 오지만 워크스페이스 이름과 워크스페이스 생성은 샘플입니다.

## 코드 구조

- `src/lib/api.ts`, `src/lib/endpoints.ts`: was 호출(주소·오류 처리)과 엔드포인트별 함수·타입
- `src/auth/AuthContext.tsx`: 로그인 상태(`/me`), 로그인·로그아웃
- `src/data/ProjectsContext.tsx`: 프로젝트·서비스 목록과 생성·수정·삭제(was 응답을 화면 모델로 바꿈)
- `src/data/useDeploymentLogs.ts`, `src/data/deploymentLogModel.ts`, `src/data/logLines.ts`, `src/pages/project/DeploymentLogs.tsx`, `src/pages/project/NetworkLogTable.tsx`: 배포 로그 탭의 조회(빌드 로그 이어 읽기·폴링, 한 번 받는 조회), 순수 함수(행 변환·바이트·응답 시간·오류 문구), 레벨 추정·스택 트레이스 묶기(프로젝트 Logs 와 공용), 탭 화면, Network 표
- `src/data/useDiagnosis.ts`, `src/data/diagnosisModel.ts`, `src/pages/project/DiagnosisPanel.tsx`: AI 진단의 상태·폴링, 순수 함수(진단 가능 여부·오류 문구·자리표시자 분리), 화면
- `src/data/mock.ts`: 화면 모델 타입, 워크스페이스, 배포 및 로그 샘플
- `src/layouts`: Workspace/Project 공통 레이아웃
- `src/pages`: 페이지와 서비스/배포 패널
- `src/components`: 공통 UI, 커맨드 팔레트, 다이얼로그
- `src/styles`: 디자인 토큰 및 화면별 CSS

`mock.ts` 의 워크스페이스 이름(`dause's Projects`, 프로젝트 화면 상단 메뉴에 그대로 보임)과 샘플 저장소(`monitor5/*`)는 팀원 GitHub 계정의 공개 정보다. 비밀번호·토큰·이메일은 없다. 레포가 이미 공개라 '공개 전 교체'는 의미가 없고, 중립 값으로 바꿀지는 별도로 정한다.

## 검증

- TypeScript 검사와 프로덕션 빌드 통과
- 로컬 was 와 브라우저로 확인: 로그인·로그아웃·세션 만료, 프로젝트·서비스 생성/수정/삭제, 저장소 검색·주소 확인·브랜치, 서비스 설정 저장(DB 반영 확인), 커맨드 팔레트, 없는 프로젝트 안내
- `VITE_API_BASE_URL` 을 닿지 않는 주소로 바꾸면 로그인 화면에 서버 연결 안내가 표시됨

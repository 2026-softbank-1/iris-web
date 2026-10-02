# 1002 — 분석 · WAS 파이프라인 프론트 연결

작성일: 2026-10-02. 작업 브랜치: `feat/ai-analysis-integration`.
전체 서버 설계: [WAS 1002 문서](https://github.com/2026-softbank-1/iris-was/blob/feat/ai-analysis-integration/docs/1002-integration-design.md).

## 수정 내용

- Create와 Analyze & deploy를 WAS `/pipelines`에 연결했다. 분석 전 바로 BUILD를 만들지 않는다.
- 고정 commit 분석 → 부족 정보 확인 → 분석기 계획 → Dockerfile/Railpack 빌드 → 배포 단계를 표시한다.
- 후보 앱·Dockerfile·포트·명령어 및 공개 환경값/기존 Secret 참조를 입력하고 계획으로 재개한다. 소스/근거 문제의 code_review는 사용자 설정으로 해결됐다고 처리하지 않는다.
- 원본 분석 결과·원문 근거·검증·단독 Analyze only 및 명시 확인을 유지했다.
- 별도 Worker 실행 계획과 portable infrastructure dossier를 표시한다. 원본 executionAuthorized:false/blocked 상태를 보존한다.
- 배포 실패 회차의 실제 로그 진단 API를 연결했다. 마스킹된 근거·관찰·원인 후보·불확실성·추가 확인·조건부 수정안을 표시한다.
- 서버 작업을 폴링해 새로고침 후에도 복구한다. 빌드/배포 이후 취소 버튼을 제공하지 않는다.
- 계획 없는 raw BUILD를 만들던 Redeploy/수동 Rollback 메뉴를 제거했다. 새 Analyze & deploy는 현재 branch head의 새 분석 배포임을 안내한다.

## 주요 파일

| 파일 | 역할 |
|---|---|
| `src/lib/pipelineApi.ts`, `src/data/usePipeline.ts` | 파이프라인 접수·조회·입력·취소와 서버 상태 복원 |
| `src/data/pipelineModel.ts`, `pipelineReview.ts` | 단계/실패 표시와 입력·Secret 참조 검증 |
| `src/components/CreateDialog.tsx` | 저장소/브랜치/타깃 선택 후 원클릭 접수 |
| `src/pages/project/ServiceAnalysis.tsx` | 원본 분석과 질문·확인·두 종류 계획 |
| `src/lib/diagnosisApi.ts`, `src/data/useDiagnosis.ts` | 실패 deployment 회차별 진단 조회·접수 |
| `src/pages/project/FailureDiagnosis.tsx` | 근거·원인 후보·수정안/검증/rollback 표시 |
| `ServicePane.tsx`, `DeploymentPane.tsx`, `DeploymentRow.tsx` | 새 분석 배포 안내와 실패 진단·배포 이력 |
| `src/data/useDeployments.ts` | 배포 목록/상세 읽기 |

## 요청 계약과 현재 설계

모든 경로는 `/api/v1/services/{serviceId}`다. 기존 로그인 세션과 WAS 소유자 권한을 사용한다.

| 요청 | 입력/결과 |
|---|---|
| `POST /pipelines` | `{mode,autoDeploy:true,enableAutoDeploy:true}`. AI 기본, static은 명시 선택 |
| `GET /pipelines` | 최신 status/stage/questions/analysisId/deploymentRequestId/두 계획 |
| `POST /pipelines/{id}/answers` | candidate/build config + `variables:[{key,value} 또는 {key,secretRef,secretKey}]` |
| `POST /pipelines/{id}/cancel` | BUILD 이전 취소 |
| `POST·GET /deployments/{id}/diagnosis` | 해당 실패 실행 회차의 진단 |

QUEUED/ANALYZING/AWAITING_INPUT/PLANNING/BUILDING/DEPLOYING/SUCCEEDED/FAILED/CANCELLED를 표시한다. plan_ready는 계획 미리보기 완료이며 빌드/배포 완료로 표시하지 않는다.

AI 미설정 오류를 보이며 static으로 자동 대체하지 않는다. 민감한 환경 키는 실제 값 대신 기존 Kubernetes Secret 참조를 요구한다. 참조 대상은 인프라에서 서비스 namespace에 먼저 준비한다. Secret 내용을 브라우저 저장소에 저장하지 않는다.

진단/수정 제안은 원래 배포 상태를 바꾸지 않으며 자동 적용하지 않는다. 현재 기존 AWS 타깃 하나를 지원한다. 수동 역사 commit 재배포/rollback과 일반 로그·지표·Variables 샘플 탭의 서버 구현은 이번 연결 범위 밖이다.

## 적용과 검증 인계

WAS의 신규 마이그레이션/API/다섯 Worker 및 모델·AWS·GitOps 설정이 필요하다. 환경 바인딩은 iris-infra chart 0.5.0 적용과 함께 사용한다. `VITE_API_BASE_URL`은 해당 WAS를 향하게 한다.

작업 중 TypeScript·23개 테스트·build 및 로컬 API fixture 브라우저에서 질문/계획/실패 진단/새로고침을 개별 확인했다. 유료 모델·운영 클라우드 배포 검증은 하지 않았다. 마감 요청 이후 추가 검증은 실행하지 않았으며 최종 통합 검증은 사용자에게 인계한다.

# iris-web

React 19 + TypeScript + Vite 대시보드. `npm run typecheck`, `npm run build`로 검증한다.

백엔드 없이 화면을 보려면 `.env.local`에 `VITE_MOCK_API=1`을 넣고 dev 서버를 다시 띄운다. `/api/v1`을 `src/dev/mockApi.ts`가 답한다(상태는 메모리, 재시작하면 초기화).

## 디자인 작업

UI·스타일을 바꿀 때는 먼저 `toss-design` 스킬(`.claude/skills/toss-design/`)을 불러와 Toss Design System(TDS) 규칙을 따른다.

- 토큰: `.claude/skills/toss-design/styles.css`가 진입점이다. 앱은 라이트 테마(Toss grey 스케일)다.
- 메인 색은 TDS 블루가 아니라 사자 앰버 `--primary`(#ffa41b)다. 앰버 위 글자는 `--on-primary`, 흰 배경 위 앰버 글자는 `--primary-text`를 쓴다(대비 확보).
- 컴포넌트: 스킬의 `components/*.jsx`는 참고용이다. `_ds_bundle.js`(window 전역)를 앱에 로드하지 말고, `.d.ts`·`.prompt.md`를 보고 `src/components/`에 TSX로 옮긴다. 이미 있는 `src/components/ui.tsx`(Tooltip, Popover, Dialog 등)를 먼저 확인하고 고친다.
- 폰트는 TDS의 Pretendard 대신 `--font-sans`(Inter + Noto Sans KR/JP)를 쓴다. 폰트는 `index.html`에서 Google Fonts로 불러온다.
- 다크/라이트는 `<html data-theme>`로 전환한다(`src/lib/theme.ts`). 색은 테마 토큰으로만 써야 두 테마에서 함께 바뀐다.
- 색·간격은 CSS 변수로만 쓴다. 기존 변수는 `src/styles/base.css`의 `:root`에 있다.
- 아이콘은 현재 `lucide-react`를 쓴다. TDS `<Icon>`으로 바꿀지는 화면 단위로 판단한다.
- TDS는 모바일 핀테크용이다. 이 앱은 데스크톱 배포 대시보드이므로 다음은 그대로 따르지 않는다.
  - 빨강=상승/파랑=하락 규칙 대신 빨강=에러, 초록=성공으로 쓴다.
  - 모바일 전용 패턴(TabBar, BottomSheet, 24px 사이드 패딩)은 데스크톱 레이아웃에 맞게 바꾼다.

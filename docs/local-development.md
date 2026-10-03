# 로컬 개발

README 의 빠른 시작에서 옮긴 상세다.

Node.js 22.12 이상을 권장합니다.

```sh
npm install
npm run dev
```

http://localhost:5173/dashboard

로그인하려면 was(`uv run uvicorn app.main:app`)가 떠 있어야 합니다. was 가 없으면 `/login` 에 서버에 연결할 수 없다는 안내가 나옵니다.

## API 주소 (`VITE_API_BASE_URL`)

기본값은 `http://localhost:8000` 입니다. 바꾸려면 `.env.example` 을 `.env.local` 로 복사해 값을 고치고 dev 서버를 다시 띄웁니다.

- dev 서버는 브라우저 요청을 같은 origin(`/api`)으로 받아 이 주소로 프록시합니다. was 에 CORS 설정이 필요 없습니다.
- `npm run build` 결과물은 이 주소로 직접 호출합니다. 이때는 was 가 CORS(credentials)를 허용해야 합니다. 비우면 같은 origin 으로 호출합니다.
- build 기본값은 커밋된 `.env.production` 의 `https://api.likelion.uk` 입니다. Amplify 환경 변수에 `VITE_API_BASE_URL` 을 넣으면 그 값이 우선합니다. 값을 빈 문자열로 넣으면 같은 origin(`likelion.uk/api/...`)으로 호출하니 비워 두지 마세요.

## 로그인 주의

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

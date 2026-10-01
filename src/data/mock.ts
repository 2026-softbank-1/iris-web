// Mock data for the Railway dashboard clone.
// Everything the UI renders comes from here, so you can swap it for a real API later.
// Personal info (name / email / avatar) lives at the top of this file if you want to scrub it.

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogAttr {
  key: string;
  value: string;
}

export interface LogLine {
  ts: string; // ISO timestamp with offset
  message: string;
  level: LogLevel;
  attrs?: LogAttr[];
  // build-log specific fields
  step?: boolean; // renders the green check + duration
  cached?: boolean;
  duration?: string;
  output?: string[]; // collapsible step output
  marker?: 'start' | 'end';
}

export type DeploymentStatus = 'ACTIVE' | 'REMOVED' | 'CRASHED' | 'FAILED' | 'SKIPPED' | 'BUILDING';

export interface Deployment {
  id: string;
  shortId: string;
  status: DeploymentStatus;
  message: string;
  createdAt: string;
  author: string;
  authorAvatar: string;
  repo: string;
  branch: string;
  commitUrl: string;
  region: string;
  replicas: number;
  restartPolicy: string;
  maxRetries: number;
  builder: { name: string; version: string };
  runtimes: string[];
  variablesCount: number;
  buildLogs: LogLine[];
  deployLogs: LogLine[];
  buildRange: { start: string; end: string };
  deployRange: { start: string; end: string };
}

export type ServiceState = 'online' | 'offline' | 'crashed';

export interface Service {
  id: string;
  shortId: string;
  name: string;
  repo: string;
  domain?: string;
  port?: number;
  runtime?: string;
  region: string;
  regionLong: string;
  replicas: number;
  state: ServiceState;
  crashedBanner?: string;
  railwayVariables: { key: string; value: string }[];
  deployments: Deployment[];
}

export interface Project {
  id: string;
  name: string;
  environment: string;
  createdAt: string;
  updatedAt: string;
  services: Service[];
  favorite?: boolean;
}

export const user = {
  name: 'dause',
  email: 'rladngus0017@gmail.com',
  avatar: 'https://avatars.githubusercontent.com/u/108711890?v=4',
  twoFactor: false,
};

export const workspace = {
  name: "dause's Projects",
  plan: 'Trial',
  trialDaysLeft: 29,
  creditsLeft: '$4.99',
  creditsGranted: '$ 5.00',
};

const GH_AVATAR = 'https://github.com/monitor5.png';

/* ------------------------------------------------------------------ */
/* Logs                                                                */
/* ------------------------------------------------------------------ */

const zodBlock = (ts: string): LogLine[] => {
  const lines = [
    'file:///app/server/dist/config/env.js:13',
    '}).parse(process.env);',
    '   ^',
    '',
    'ZodError: [',
    '  {',
    '    "origin": "string",',
    '    "code": "too_small",',
    '    "minimum": 48,',
    '    "inclusive": true,',
    '    "path": [',
    '      "SESSION_SECRET"',
    '    ],',
    '    "message": "Too small: expected string to have >=48 characters"',
    '  }',
    ']',
    '    at file:///app/server/dist/config/env.js:13:4',
    '    at ModuleJob.run (node:internal/modules/esm/module_job:561:25)',
    '    at async node:internal/modules/esm/loader:647:26',
    '    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)',
    '',
    'Node.js v24.21.0',
  ];
  return lines.map((message) => ({ ts, message, level: 'error' as const }));
};

const crashDeployLogs: LogLine[] = [
  { ts: '2026-09-30T20:23:13.000+09:00', message: 'Starting Container', level: 'info' },
  ...zodBlock('2026-09-30T20:23:14.402+09:00'),
  ...zodBlock('2026-09-30T20:23:15.511+09:00'),
  ...zodBlock('2026-09-30T20:23:16.634+09:00'),
  ...zodBlock('2026-09-30T20:23:17.652+09:00'),
  ...zodBlock('2026-09-30T20:23:18.675+09:00'),
  ...zodBlock('2026-09-30T20:23:19.701+09:00'),
  ...zodBlock('2026-09-30T20:23:20.733+09:00'),
  ...zodBlock('2026-09-30T20:23:21.759+09:00'),
  ...zodBlock('2026-09-30T20:23:22.781+09:00'),
  ...zodBlock('2026-09-30T20:23:23.806+09:00'),
];

const dockerBuildLogs: LogLine[] = [
  { ts: '2026-09-30T20:22:58.100+09:00', message: 'unpacking archive', level: 'info', step: true, duration: '7ms', attrs: [{ key: '', value: '830 KB' }] },
  { ts: '2026-09-30T20:22:58.110+09:00', message: 'uploading snapshot', level: 'info', attrs: [{ key: '', value: '265 KB' }] },
  { ts: '2026-09-30T20:22:58.200+09:00', message: '[internal] load build definition from Dockerfile', level: 'info', step: true, duration: '1ms' },
  { ts: '2026-09-30T20:22:58.210+09:00', message: '[internal] load metadata for docker.io/library/node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1', level: 'info', step: true, duration: '25ms' },
  { ts: '2026-09-30T20:22:58.220+09:00', message: '[internal] load .dockerignore', level: 'info', step: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.230+09:00', message: '[internal] load build context', level: 'info', step: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.240+09:00', message: '[build] FROM docker.io/library/node:24.21.0-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1', level: 'info', step: true, duration: '13ms' },
  { ts: '2026-09-30T20:22:58.250+09:00', message: '[build] COPY client/ client/', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.260+09:00', message: '[build] RUN npm ci --ignore-scripts', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.270+09:00', message: '[stage-2] COPY --from=runtime-deps /app/node_modules /app/node_modules', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.280+09:00', message: '[runtime-deps] RUN npm ci --omit=dev --ignore-scripts --workspace=server', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.290+09:00', message: '[build] COPY server/package.json server/package.json', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.300+09:00', message: '[build] COPY client/package.json client/package.json', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.310+09:00', message: '[build] COPY package.json package-lock.json ./', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.320+09:00', message: '[build] WORKDIR /app', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.330+09:00', message: '[stage-2] WORKDIR /app/server', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.340+09:00', message: '[stage-2] RUN mkdir -p /data/uploads && chown -R node:node /data &&     rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-*     /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.350+09:00', message: '[stage-2] COPY docker/healthcheck.cjs /app/healthcheck.cjs', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.360+09:00', message: '[stage-2] COPY --from=build /app/package.json /app/package.json', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.370+09:00', message: '[stage-2] COPY --from=build /app/client/dist /app/public', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.380+09:00', message: '[stage-2] COPY --from=build /app/server/package.json ./package.json', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.390+09:00', message: '[stage-2] COPY --from=build /app/server/dist ./dist', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.400+09:00', message: '[build] RUN npm run build', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.410+09:00', message: '[build] COPY server/ server/', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:22:58.900+09:00', message: 'exporting to docker image format', level: 'info', step: true, duration: '389ms' },
  { ts: '2026-09-30T20:22:59.100+09:00', message: 'containerimage.digest: sha256:25bdc768f8165f4bdb6d62d9387c259e430b677c877bbd108cb067575496d3bf', level: 'info' },
  { ts: '2026-09-30T20:22:59.105+09:00', message: 'containerimage.descriptor: eyJtZWRpYVR5cGUiOiJhcHBsaWNhdGlvbi92bmQub2NpLmltYWdlLm1hbmlmZXN0LnYxK2pzb24iLCJkaWdlc3QiOiJzaGEyNTY6MjViZGM3NjhmODE2NWY0YmRiNmQ2MmQ5Mzg3YzI1OWU0MzBiNjc3Yzg3N2JiZDEwOGNiMDY3NTc1NDk2ZDNiZiIsInNpemUiOjI1NjgsImFubm90YXRpb25zIjp7Im9yZy5vcGVuY29udGFpbmVycy5pbWFnZS5jcmVhdGVkIjoiMjAyNi0wOS0zMFQxMToyMjo1OFoifSwicGxhdGZvcm0iOnsiYXJjaGl0ZWN0dXJlIjoiYW1kNjQiLCJvcyI6ImxpbnV4In19', level: 'info' },
  { ts: '2026-09-30T20:22:59.110+09:00', message: 'containerimage.config.digest: sha256:60b1d06dda8307a4a6713449c11340e5d30c508992da54d28ecb5196db61c8eb', level: 'info' },
  { ts: '2026-09-30T20:23:01.000+09:00', message: 'image push', level: 'info', step: true, duration: '2s', attrs: [{ key: '', value: '81.9 MB' }] },
  { ts: '2026-09-30T20:23:02.000+09:00', message: 'scheduling build on Metal builder "builder-tvghxu"', level: 'info' },
];

const railpackBuildLogs: LogLine[] = [
  { ts: '2026-09-30T20:34:00.100+09:00', message: 'scheduling build on Metal builder "builder-tdfars"', level: 'info' },
  { ts: '2026-09-30T20:34:00.200+09:00', message: 'using build driver railpack-v0.40.1', level: 'info' },
  { ts: '2026-09-30T20:34:00.300+09:00', message: 'unpacking archive', level: 'info', step: true, duration: '5ms', attrs: [{ key: '', value: '630 KB' }] },
  { ts: '2026-09-30T20:34:00.400+09:00', message: 'uploading snapshot', level: 'info', attrs: [{ key: '', value: '338.5 KB' }] },
  { ts: '2026-09-30T20:34:01.000+09:00', message: 'local://prepare-driver', level: 'info', step: true, duration: '0ms' },
  { ts: '2026-09-30T20:34:01.100+09:00', message: 'local://prepare-context', level: 'info', step: true, duration: '0ms' },
  {
    ts: '2026-09-30T20:34:01.200+09:00',
    message: 'prepare railpack-v0.40.1',
    level: 'info',
    step: true,
    duration: '3s',
    output: [
      '╭─────────────────╮',
      '│ Railpack 0.40.1 │',
      '╰─────────────────╯',
      '',
      '  ↳ Detected Node',
      '  ↳ Using npm package manager',
      '  ↳ Deploying as vite static site',
      '  ↳ Output directory: dist',
      '',
      '  Packages',
      '  ──────────',
      '  node   │  24.21.0  │  idiomatic-version-file (24.21.0)',
      '  caddy  │  2.11.4   │  railpack default (latest)',
      '',
      '  Steps',
      '  ──────────',
      '  ▸ install',
      '    $ npm install',
      '  ▸ build',
      '    $ npm run build',
      '',
      '  Deploy',
      '  ──────────',
      '    $ caddy run --config /Caddyfile --adapter caddyfile 2>&1',
    ],
  },
  { ts: '2026-09-30T20:34:05.000+09:00', message: 'load build definition from ./railpack-plan.json', level: 'info', step: true, duration: '0ms' },
  { ts: '2026-09-30T20:34:05.010+09:00', message: 'copy .nvmrc', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:34:05.020+09:00', message: 'mise install-into caddy@2.11.4 /railpack/caddy', level: 'info', step: true, duration: '1s', output: ['mise caddy@2.11.4 ✓ installed'] },
  { ts: '2026-09-30T20:34:05.030+09:00', message: 'install mise packages: node', level: 'info', step: true, duration: '2s', output: ['mise ████████████████ 1/1 · installed 1 tool in 1.7s'] },
  { ts: '2026-09-30T20:34:05.040+09:00', message: 'mkfile /Caddyfile', level: 'info', step: true, duration: '493ms' },
  { ts: '2026-09-30T20:34:05.050+09:00', message: 'caddy fmt --overwrite /Caddyfile', level: 'info', step: true, duration: '864ms' },
  { ts: '2026-09-30T20:34:05.060+09:00', message: 'mkdir -p /app/node_modules/.cache', level: 'info', step: true, duration: '686ms' },
  { ts: '2026-09-30T20:34:05.070+09:00', message: 'copy .nvmrc, package-lock.json, package.json', level: 'info', step: true, duration: '742ms' },
  { ts: '2026-09-30T20:34:05.080+09:00', message: 'npm install', level: 'info', step: true, duration: '1s', output: ['found 0 vulnerabilities'] },
  { ts: '2026-09-30T20:34:05.090+09:00', message: 'copy / /app', level: 'info', step: true, duration: '235ms' },
  { ts: '2026-09-30T20:34:05.100+09:00', message: 'npm run build', level: 'info', step: true, duration: '1s', output: ['✓ built in 180ms'] },
  { ts: '2026-09-30T20:34:05.110+09:00', message: 'copy /railpack/caddy', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:34:05.120+09:00', message: 'copy /app/dist', level: 'info', step: true, duration: '145ms' },
  { ts: '2026-09-30T20:34:05.130+09:00', message: 'install apt packages: libatomic1', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:34:05.140+09:00', message: 'copy /Caddyfile', level: 'info', step: true, cached: true, duration: '0ms' },
  { ts: '2026-09-30T20:34:13.000+09:00', message: 'exporting to docker image format', level: 'info', step: true, duration: '530ms' },
  { ts: '2026-09-30T20:34:14.000+09:00', message: 'containerimage.config.digest: sha256:358477c844fa963481c2b3f95ca37e71cd21d32efda76af053508d40b3096d7b', level: 'info' },
  { ts: '2026-09-30T20:34:14.010+09:00', message: 'containerimage.digest: sha256:888b28f351e5673beec2d686717222b6ac86afc63109493278d67e744eefdebe', level: 'info' },
  { ts: '2026-09-30T20:34:18.000+09:00', message: 'image push', level: 'info', step: true, duration: '4s', attrs: [{ key: '', value: '52.9 MB' }] },
];

// Request logs are trimmed and IPs replaced with documentation ranges (203.0.113.0/24).
const req = (ts: string, epoch: string, uri: string, port: string, size: string, duration: string, type: string): LogLine => ({
  ts,
  message: 'handled request',
  level: 'info',
  attrs: [
    { key: 'ts', value: epoch },
    { key: 'logger', value: 'http.log.access.log0' },
    { key: 'request.remote_ip', value: '100.64.0.2' },
    { key: 'request.remote_port', value: port },
    { key: 'request.client_ip', value: '203.0.113.24' },
    { key: 'request.proto', value: 'HTTP/1.1' },
    { key: 'request.method', value: 'GET' },
    { key: 'request.host', value: 'portpolio-production-production.up.railway.app' },
    { key: 'request.uri', value: uri },
    { key: 'request.headers.X-Railway-Edge[0]', value: 'sin1' },
    { key: 'duration', value: duration },
    { key: 'size', value: size },
    { key: 'status', value: '200' },
    { key: 'resp_headers.Content-Type[0]', value: type },
  ],
});

const caddyDeployLogs: LogLine[] = [
  { ts: '2026-09-30T20:34:24.000+09:00', message: 'Starting Container', level: 'info' },
  { ts: '2026-09-30T20:34:24.100+09:00', message: 'maxprocs: Updating GOMAXPROCS=2: determined from CPU quota', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7449222' }] },
  { ts: '2026-09-30T20:34:24.110+09:00', message: 'GOMEMLIMIT is updated', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7449408' }, { key: 'GOMEMLIMIT', value: '899997696' }, { key: 'previous', value: '9223372036854776000' }] },
  { ts: '2026-09-30T20:34:24.120+09:00', message: 'using config from file', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7449434' }, { key: 'file', value: '/Caddyfile' }] },
  { ts: '2026-09-30T20:34:24.130+09:00', message: 'adapted config to JSON', level: 'info', attrs: [{ key: 'ts', value: '1790768063.744945' }, { key: 'adapter', value: 'caddyfile' }] },
  { ts: '2026-09-30T20:34:24.140+09:00', message: 'admin endpoint disabled', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7449548' }, { key: 'logger', value: 'admin' }] },
  { ts: '2026-09-30T20:34:24.150+09:00', message: 'automatic HTTPS is completely disabled for server', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7450612' }, { key: 'logger', value: 'http.auto_https' }, { key: 'server_name', value: 'srv0' }] },
  { ts: '2026-09-30T20:34:24.160+09:00', message: 'started background certificate maintenance', level: 'info', attrs: [{ key: 'ts', value: '1790768063.74527' }, { key: 'logger', value: 'tls.cache.maintenance' }, { key: 'cache', value: '0x3af54db46200' }] },
  { ts: '2026-09-30T20:34:24.170+09:00', message: 'HTTP/2 skipped because it requires TLS', level: 'warn', attrs: [{ key: 'ts', value: '1790768063.7455084' }, { key: 'logger', value: 'http' }, { key: 'network', value: 'tcp' }, { key: 'addr', value: ':8080' }] },
  { ts: '2026-09-30T20:34:24.180+09:00', message: 'HTTP/3 skipped because it requires TLS', level: 'warn', attrs: [{ key: 'ts', value: '1790768063.745516' }, { key: 'logger', value: 'http' }, { key: 'network', value: 'tcp' }, { key: 'addr', value: ':8080' }] },
  { ts: '2026-09-30T20:34:24.190+09:00', message: 'server running', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7455175' }, { key: 'logger', value: 'http.log' }, { key: 'name', value: 'srv0' }, { key: 'protocols[0]', value: 'h1' }, { key: 'protocols[1]', value: 'h2' }, { key: 'protocols[2]', value: 'h3' }] },
  { ts: '2026-09-30T20:34:24.200+09:00', message: 'serving initial configuration', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7455478' }] },
  { ts: '2026-09-30T20:34:24.210+09:00', message: 'cleaning storage unit', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7470436' }, { key: 'logger', value: 'tls' }, { key: 'storage', value: 'FileStorage:/root/.local/share/caddy' }] },
  { ts: '2026-09-30T20:34:24.220+09:00', message: 'finished cleaning storage units', level: 'info', attrs: [{ key: 'ts', value: '1790768063.7474494' }, { key: 'logger', value: 'tls' }] },
  req('2026-09-30T20:37:24.100+09:00', '1790768235.2688258', '/', '40588', '636', '0.000636878', 'text/html; charset=utf-8'),
  req('2026-09-30T20:37:24.200+09:00', '1790768235.5905745', '/assets/index-DcM5gtY8.css', '50144', '10439', '0.001456703', 'text/css; charset=utf-8'),
  req('2026-09-30T20:37:24.300+09:00', '1790768235.5912251', '/assets/index-DGnY17kv.js', '50130', '36220', '0.002109731', 'text/javascript; charset=utf-8'),
  req('2026-09-30T20:37:24.400+09:00', '1790768236.7840383', '/assets/travel-home-latest.webp', '50774', '113370', '0.002028933', 'image/webp'),
  req('2026-09-30T20:37:24.500+09:00', '1790768236.7874844', '/assets/indoor-ai-location.webp', '37888', '69862', '0.001578391', 'image/webp'),
  req('2026-09-30T20:37:24.600+09:00', '1790768237.1260786', '/favicon.svg', '39112', '224', '0.000210596', 'image/svg+xml'),
  req('2026-09-30T20:37:24.700+09:00', '1790768239.2453206', '/assets/llm-defense-cover.jpg', '39112', '51112', '0.000892224', 'image/jpeg'),
  { ts: '2026-10-01T20:34:27.000+09:00', message: 'cleaning storage unit', level: 'info', attrs: [{ key: 'ts', value: '1790854463.8429317' }, { key: 'logger', value: 'tls' }, { key: 'storage', value: 'FileStorage:/root/.local/share/caddy' }] },
  { ts: '2026-10-01T20:34:27.100+09:00', message: 'finished cleaning storage units', level: 'info', attrs: [{ key: 'ts', value: '1790854463.8436537' }, { key: 'logger', value: 'tls' }] },
];

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

const railwayVars = (service: string, domain?: string) => [
  { key: 'RAILWAY_ENVIRONMENT', value: 'production' },
  { key: 'RAILWAY_ENVIRONMENT_ID', value: '7d1c2a40-…' },
  { key: 'RAILWAY_ENVIRONMENT_NAME', value: 'production' },
  { key: 'RAILWAY_PRIVATE_DOMAIN', value: `${service.toLowerCase()}.railway.internal` },
  { key: 'RAILWAY_PROJECT_ID', value: '…' },
  { key: 'RAILWAY_PROJECT_NAME', value: '…' },
  { key: 'RAILWAY_SERVICE_ID', value: '…' },
  { key: 'RAILWAY_SERVICE_NAME', value: service },
  ...(domain ? [{ key: 'RAILWAY_PUBLIC_DOMAIN', value: domain }] : []),
].slice(0, 8);

export const projects: Project[] = [
  {
    id: '1dbb463d-a2a3-49b3-93b9-fd737bd0bc13',
    name: 'believable-playfulness',
    environment: 'production',
    createdAt: '2026-09-30T20:26:00+09:00',
    updatedAt: '2026-09-30T20:33:58+09:00',
    services: [
      {
        id: '3902d5e1-6f0a-4f43-9c7e-0f8d6c1b2a77',
        shortId: '3902d5',
        name: 'portpolio-production',
        repo: 'monitor5/portpolio-production',
        domain: 'portpolio-production-production.up.railway.app',
        port: 8080,
        runtime: 'node@24.21.0',
        region: 'US West',
        regionLong: 'US West (California, USA)',
        replicas: 1,
        state: 'online',
        railwayVariables: railwayVars('portpolio-production', 'portpolio-production-production.up.railway.app'),
        deployments: [
          {
            id: '647b8145-0c5e-4a9b-8a51-2f0d5e7c1a90',
            shortId: '647b8145',
            status: 'ACTIVE',
            message: 'Complete temporary domain cutover and enable automatic deployment',
            createdAt: '2026-09-30T20:33:58.666+09:00',
            author: 'monitor5',
            authorAvatar: GH_AVATAR,
            repo: 'monitor5/portpolio-production',
            branch: 'main',
            commitUrl: 'https://github.com/monitor5/portpolio-production',
            region: 'sfo',
            replicas: 1,
            restartPolicy: 'on failure',
            maxRetries: 10,
            builder: { name: 'Railpack', version: '0.40.1' },
            runtimes: ['node @ 24.21.0', 'caddy @ 2.11.4'],
            variablesCount: 0,
            buildLogs: railpackBuildLogs,
            deployLogs: caddyDeployLogs,
            buildRange: { start: '2026-09-30 20:28', end: '2026-09-30 20:39' },
            deployRange: { start: '2026-09-30 20:33', end: '2026-10-01 21:01' },
          },
        ],
      },
    ],
  },
  {
    id: '4826cfb7-57e8-4fe6-8846-31a26046e012',
    name: 'friendly-courtesy',
    environment: 'production',
    createdAt: '2026-09-30T20:12:00+09:00',
    updatedAt: '2026-09-30T20:22:58+09:00',
    services: [
      {
        id: '98a74c20-3b1e-4d8f-a6c2-5e9f1b7d3c44',
        shortId: '98a74c',
        name: 'Temp_log',
        repo: 'monitor5/Temp_log',
        region: 'US West',
        regionLong: 'US West (California, USA)',
        replicas: 1,
        // The latest deployment crash-looped (SESSION_SECRET too short) and was removed,
        // so the service is now offline. Use 'crashed' to show the red dashboard state instead.
        state: 'offline',
        crashedBanner: "Deployment was removed because it's been crashed for too long",
        railwayVariables: railwayVars('Temp_log'),
        deployments: [
          {
            id: '8e31b2c0-77a4-4b0e-9d3f-1c2b3a4d5e6f',
            shortId: '8e31b2c0',
            status: 'REMOVED',
            message: 'Make Temp-Log a neutral personal blog with empty terms',
            createdAt: '2026-09-30T20:22:58.429+09:00',
            author: 'monitor5',
            authorAvatar: GH_AVATAR,
            repo: 'monitor5/Temp_log',
            branch: 'main',
            commitUrl: 'https://github.com/monitor5/Temp_log',
            region: 'sfo',
            replicas: 1,
            restartPolicy: 'on failure',
            maxRetries: 10,
            builder: { name: 'Dockerfile', version: '' },
            runtimes: ['node @ 24.21.0'],
            variablesCount: 3,
            buildLogs: dockerBuildLogs,
            deployLogs: crashDeployLogs,
            buildRange: { start: '2026-09-30 20:17', end: '2026-10-01 21:06' },
            deployRange: { start: '2026-09-30 20:22', end: '2026-10-01 21:01' },
          },
          {
            id: '2b7d9e01-1c3f-4e55-8a9b-6d7c8e9f0a1b',
            shortId: '2b7d9e01',
            status: 'REMOVED',
            message: 'Make Temp-Log a neutral personal blog with empty terms',
            createdAt: '2026-09-30T20:22:56.434+09:00',
            author: 'monitor5',
            authorAvatar: GH_AVATAR,
            repo: 'monitor5/Temp_log',
            branch: 'main',
            commitUrl: 'https://github.com/monitor5/Temp_log',
            region: 'sfo',
            replicas: 1,
            restartPolicy: 'on failure',
            maxRetries: 10,
            builder: { name: 'Dockerfile', version: '' },
            runtimes: ['node @ 24.21.0'],
            variablesCount: 3,
            buildLogs: dockerBuildLogs,
            deployLogs: crashDeployLogs,
            buildRange: { start: '2026-09-30 20:17', end: '2026-10-01 21:06' },
            deployRange: { start: '2026-09-30 20:22', end: '2026-10-01 21:01' },
          },
          {
            id: 'c4e5f6a7-8b9c-4d0e-9f1a-2b3c4d5e6f70',
            shortId: 'c4e5f6a7',
            status: 'REMOVED',
            message: 'Make Temp-Log a neutral personal blog with empty terms',
            createdAt: '2026-09-30T20:19:23.469+09:00',
            author: 'monitor5',
            authorAvatar: GH_AVATAR,
            repo: 'monitor5/Temp_log',
            branch: 'main',
            commitUrl: 'https://github.com/monitor5/Temp_log',
            region: 'sfo',
            replicas: 1,
            restartPolicy: 'on failure',
            maxRetries: 10,
            builder: { name: 'Dockerfile', version: '' },
            runtimes: ['node @ 24.21.0'],
            variablesCount: 3,
            buildLogs: dockerBuildLogs,
            deployLogs: crashDeployLogs,
            buildRange: { start: '2026-09-30 20:14', end: '2026-10-01 21:06' },
            deployRange: { start: '2026-09-30 20:19', end: '2026-10-01 21:01' },
          },
        ],
      },
    ],
  },
];

export const getProject = (id?: string) => projects.find((p) => p.id === id);
export const getService = (project?: Project, sid?: string) =>
  project?.services.find((s) => s.id === sid || s.shortId === sid);
export const getDeployment = (service?: Service, did?: string) =>
  service?.deployments.find((d) => d.id === did || d.shortId === did);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function timeAgo(iso: string, now = new Date()): string {
  const diff = Math.max(0, now.getTime() - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return 'a few seconds ago';
  const m = Math.floor(s / 60);
  if (m < 2) return 'a minute ago';
  if (m < 45) return `${m} minutes ago`;
  const h = Math.floor(m / 60);
  if (h < 2) return 'an hour ago';
  if (h < 22) return `${h} hours ago`;
  const d = Math.floor(h / 24);
  if (d < 2) return '1 day ago';
  if (d < 26) return `${d} days ago`;
  const mo = Math.floor(d / 30);
  if (mo < 2) return 'a month ago';
  return `${mo} months ago`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Formats an ISO date in Asia/Seoul (GMT+9) like Railway does for this account. */
export function fmtKst(iso: string, withSeconds = true): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const base = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getUTCSeconds())}` : base;
}

export function fmtKstFull(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${fmtKst(iso)}.${ms} GMT+9`;
}

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, afterEach } from 'node:test';
import ts from 'typescript';
import { pipelineSteps, pipelineFailureMessage } from '../src/data/pipelineModel.ts';
import { initialPipelineVariables, pipelineVariables } from '../src/data/pipelineReview.ts';

const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const transpile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const apiUrl = moduleUrl(transpile(await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8')).replaceAll('import.meta.env', '({ DEV: true })'));
const api = await import(apiUrl);
const loadApi = async (file) => import(moduleUrl(transpile(await readFile(new URL(`../src/lib/${file}`, import.meta.url), 'utf8')).replace("from './api'", `from '${apiUrl}'`)));
const pipeline = await loadApi('pipelineApi.ts');
const diagnosis = await loadApi('diagnosisApi.ts');
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; api.setUnauthorizedHandler(null); });
const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('one-click workflow explicitly authorizes analysis, plan, deployment and future analyzed pushes', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return respond(202, { success: true, data: { id: 'run-1', status: 'ANALYZING' } }); };
  await pipeline.startPipeline(7, 'opencode');
  await pipeline.getPipeline(7);
  await pipeline.answerPipeline(7, 'run-1', { serviceCandidateId: 'api', port: 8080, variables: [{ key: 'DATABASE_URL', secretRef: 'api-credentials', secretKey: 'connection' }] });
  await pipeline.cancelPipeline(7, 'run-1');
  assert.deepEqual(calls.map((call) => [call.method, call.url]), [
    ['POST', '/api/v1/services/7/pipelines'], ['GET', '/api/v1/services/7/pipelines'],
    ['POST', '/api/v1/services/7/pipelines/run-1/answers'], ['POST', '/api/v1/services/7/pipelines/run-1/cancel'],
  ]);
  assert.ok(calls.every((call) => call.credentials === 'include'));
  assert.ok(calls[0].headers['Idempotency-Key']);
  assert.deepEqual(JSON.parse(calls[0].body), { mode: 'opencode', autoDeploy: true, enableAutoDeploy: true });
  assert.deepEqual(JSON.parse(calls[2].body).variables, [{ key: 'DATABASE_URL', secretRef: 'api-credentials', secretKey: 'connection' }]);
});

test('unconfigured AI never submits an implicit static workflow or a direct deployment', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return respond(503, { success: false, code: 'MODEL_NOT_CONFIGURED', message: 'Missing model' }); };
  await assert.rejects(pipeline.startPipeline(7, 'opencode'), (error) => error.code === 'MODEL_NOT_CONFIGURED');
  assert.equal(calls.length, 1);
  assert.equal(JSON.parse(calls[0].body).mode, 'opencode');
  assert.equal(calls[0].url, '/api/v1/services/7/pipelines');
});

test('static analysis is an explicit workflow choice and awaiting input remains open', async () => {
  globalThis.fetch = async (_url, options) => { assert.equal(JSON.parse(options.body).mode, 'static'); return respond(202, { success: true, data: {} }); };
  await pipeline.startPipeline(7, 'static');
  assert.equal(pipeline.isPipelineActive('QUEUED'), true);
  assert.equal(pipeline.isPipelineActive('AWAITING_INPUT'), false);
  assert.equal(pipeline.isPipelineOpen('AWAITING_INPUT'), true);
  assert.equal(pipeline.isPipelineOpen('SUCCEEDED'), false);
});

test('missing workflow errors stay distinct from missing or inaccessible services', async () => {
  globalThis.fetch = async () => respond(404, { success: false, code: 'PIPELINE_NOT_FOUND', message: 'No workflow' });
  await assert.rejects(pipeline.getPipeline(7), (error) => error.code === 'PIPELINE_NOT_FOUND');
  globalThis.fetch = async () => respond(404, { success: false, code: 'SERVICE_NOT_FOUND', message: 'No service' });
  await assert.rejects(pipeline.getPipeline(7), (error) => error.code === 'SERVICE_NOT_FOUND');
});

test('workflow stage display does not mark unexecuted stages complete on failure', () => {
  assert.deepEqual(pipelineSteps({ status: 'AWAITING_INPUT', stage: 'awaiting_input' }).map((step) => step.state), ['complete', 'current', 'pending', 'pending', 'pending']);
  assert.deepEqual(pipelineSteps({ status: 'FAILED', stage: 'analysis_failed' }).map((step) => step.state), ['stopped', 'pending', 'pending', 'pending', 'pending']);
  assert.deepEqual(pipelineSteps({ status: 'FAILED', stage: 'deployment_failed' }).map((step) => step.state), ['complete', 'complete', 'complete', 'complete', 'stopped']);
  assert.deepEqual(pipelineSteps({ status: 'FAILED', stage: 'failed' }).map((step) => step.state), ['pending', 'pending', 'pending', 'pending', 'pending']);
  assert.deepEqual(pipelineSteps({ status: 'SUCCEEDED', stage: 'succeeded' }).map((step) => step.state), ['complete', 'complete', 'complete', 'complete', 'complete']);
  assert.deepEqual(pipelineSteps({ status: 'SUCCEEDED', stage: 'plan_ready' }).map((step) => step.state), ['complete', 'complete', 'complete', 'pending', 'pending']);
  assert.match(pipelineFailureMessage('PIPELINE_STALE'), /same commit/);
});

test('required variable questions default to references and preserve the required key', () => {
  const variables = initialPipelineVariables([{ key: 'port' }, { key: 'variables.DATABASE_URL' }, { key: 'variables.DATABASE_URL' }, { key: 'variables.NODE_ENV' }]);
  assert.deepEqual(variables.map((item) => [item.key, item.mode, item.secretKey]), [['DATABASE_URL', 'secret', 'DATABASE_URL'], ['NODE_ENV', 'secret', 'NODE_ENV']]);
  assert.ok(variables.every((item) => item.value === '' && item.secretRef === ''));
});

test('environment bindings validate before submission and never send secret drafts as public values', () => {
  const base = { key: 'DATABASE_URL', mode: 'secret', value: 'discarded secret draft', secretRef: 'app-credentials', secretKey: 'connection' };
  assert.deepEqual(pipelineVariables([base]), [{ key: 'DATABASE_URL', secretRef: 'app-credentials', secretKey: 'connection' }]);
  assert.throws(() => pipelineVariables([{ ...base, mode: 'public' }]), /existing Secret/);
  assert.throws(() => pipelineVariables([{ ...base, key: '9INVALID' }]), /Environment key/);
  assert.throws(() => pipelineVariables([{ ...base, secretRef: '' }]), /Secret name and key/);
  assert.throws(() => pipelineVariables([base, base]), /more than once/);
  assert.deepEqual(pipelineVariables([{ ...base, key: 'NODE_ENV', mode: 'public', value: 'production' }]), [{ key: 'NODE_ENV', value: 'production' }]);
});

test('log diagnosis is scoped to one deployment attempt and submits no browser log text', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return respond(200, { success: true, data: { status: 'QUEUED' } }); };
  await diagnosis.getDiagnosis('7', '55');
  await diagnosis.startDiagnosis('7', '55');
  assert.deepEqual(calls.map((call) => [call.method, call.url]), [['GET', '/api/v1/services/7/deployments/55/diagnosis'], ['POST', '/api/v1/services/7/deployments/55/diagnosis']]);
  assert.equal(calls[1].body, undefined);
  assert.ok(calls.every((call) => call.credentials === 'include'));
  assert.equal(diagnosis.isDiagnosisActive('RUNNING'), true);
  assert.equal(diagnosis.isDiagnosisActive('TIMED_OUT'), false);
});

test('diagnosis and workflow requests share the session expiration boundary', async () => {
  let redirects = 0;
  api.setUnauthorizedHandler(() => { redirects++; });
  globalThis.fetch = async () => respond(401, { success: false, code: 'UNAUTHORIZED', message: 'Expired' });
  await assert.rejects(diagnosis.getDiagnosis('7', '55'));
  await assert.rejects(pipeline.getPipeline(7));
  assert.equal(redirects, 2);
});

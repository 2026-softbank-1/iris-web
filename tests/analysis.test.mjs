import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test, afterEach } from 'node:test';
import ts from 'typescript';
import { initialReviewDraft, candidateBuildAdvice, fillEmptyRecommendations, reviewAnswers } from '../src/data/analysisReview.ts';

// Load the production request boundary with Vite's development environment supplied.
const moduleUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const transpile = (source) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const apiUrl = moduleUrl(transpile(await readFile(new URL('../src/lib/api.ts', import.meta.url), 'utf8')).replaceAll('import.meta.env', '({ DEV: true })'));
const api = await import(apiUrl);
const analysis = await import(moduleUrl(transpile(await readFile(new URL('../src/lib/analysisApi.ts', import.meta.url), 'utf8')).replace("from './api'", `from '${apiUrl}'`)));
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; api.setUnauthorizedHandler(null); });
const respond = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const field = (value, scope = 'container', status = 'detected') => ({ value, scope, status, reason: 'Source observation', evidenceIds: ['evidence-1'] });
const candidate = (id = 'api', root = 'api') => ({ serviceId: id, root: field(root, 'source'), buildCommand: field('npm run build'), startCommand: field('node dist/index.js'), ports: [field(9000, 'host_mapping'), field(8080)] });
const job = (services = [candidate()]) => ({ id: 'analysis-1', serviceId: 7, status: 'SUCCEEDED', analysisStatus: 'needs_input', builderRecommendation: 'railpack', analysisResult: { services }, reviewRequired: true, deploymentAuthorized: false });

test('creating, polling, cancelling and answering analysis keep credentials and use analysis endpoints only', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, ...options }); return respond(200, { success: true, data: job() }); };
  await analysis.startAnalysis(7, 'opencode');
  await analysis.getAnalysis(7);
  await analysis.cancelAnalysis(7, 'analysis-1');
  await analysis.answerAnalysis(7, { analysisId: 'analysis-1', serviceCandidateId: 'api', builder: 'railpack', port: 8080 });
  assert.deepEqual(calls.map((call) => [call.method, call.url]), [
    ['POST', '/api/v1/services/7/analysis'], ['GET', '/api/v1/services/7/analysis'],
    ['POST', '/api/v1/services/7/analysis/cancel'], ['POST', '/api/v1/services/7/analysis/answers'],
  ]);
  assert.ok(calls.every((call) => call.credentials === 'include'));
  assert.deepEqual(JSON.parse(calls[0].body), { mode: 'opencode' });
  assert.deepEqual(JSON.parse(calls[2].body), { analysisId: 'analysis-1' });
  assert.equal(JSON.parse(calls[3].body).serviceCandidateId, 'api');
});

test('missing analysis remains a specific 404 and cannot mask a missing service', async () => {
  globalThis.fetch = async () => respond(404, { success: false, code: 'ANALYSIS_NOT_FOUND', message: 'No analysis' });
  await assert.rejects(analysis.getAnalysis(7), (error) => error instanceof api.ApiError && error.status === 404 && error.code === 'ANALYSIS_NOT_FOUND');
  globalThis.fetch = async () => respond(404, { success: false, code: 'SERVICE_NOT_FOUND', message: 'No service' });
  await assert.rejects(analysis.getAnalysis(7), (error) => error.code === 'SERVICE_NOT_FOUND');
});

test('expired sessions invoke the authentication boundary', async () => {
  let redirects = 0;
  api.setUnauthorizedHandler(() => { redirects++; });
  globalThis.fetch = async () => respond(401, { success: false, code: 'UNAUTHORIZED', message: 'Expired' });
  await assert.rejects(analysis.getAnalysis(7));
  assert.equal(redirects, 1);
});

test('unconfigured AI is reported explicitly and never silently falls back to static', async () => {
  let requests = 0;
  globalThis.fetch = async () => { requests++; return respond(503, { success: false, code: 'MODEL_NOT_CONFIGURED', message: 'Missing credentials' }); };
  await assert.rejects(analysis.startAnalysis(7, 'opencode'), (error) => {
    assert.equal(error.code, 'MODEL_NOT_CONFIGURED');
    assert.match(api.describeError(error), /Static analysis/);
    return true;
  });
  assert.equal(requests, 1);
});

test('initial review preserves all existing settings and requires a builder when absent', () => {
  const saved = { rootDirectory: 'api', builder: 'dockerfile', dockerfilePath: 'api/Dockerfile', port: 3000, buildCommand: 'make build', startCommand: 'make start' };
  assert.deepEqual(initialReviewDraft(saved, job()), { candidateId: 'api', builder: 'dockerfile', dockerfilePath: 'api/Dockerfile', port: '3000', buildCommand: 'make build', startCommand: 'make start' });
  assert.equal(initialReviewDraft(undefined, job()).builder, '');
});

test('multiple candidates require a selection unless the saved root identifies one', () => {
  const result = job([candidate(), candidate('web', 'web')]);
  assert.equal(initialReviewDraft(undefined, result).candidateId, '');
  assert.equal(initialReviewDraft({ rootDirectory: 'web' }, result).candidateId, 'web');
});

test('candidates sharing a root are never selected by list order', () => {
  const result = initialReviewDraft({ rootDirectory: 'api' }, job([candidate('one', 'api'), candidate('two', 'api')]));
  assert.equal(result.candidateId, '');
});

test('explicit recommendations use container ports and do not overwrite saved or edited settings', () => {
  const existing = { candidateId: 'api', builder: 'dockerfile', dockerfilePath: 'api/Dockerfile', port: '3000', buildCommand: 'make build', startCommand: 'make start' };
  assert.deepEqual(fillEmptyRecommendations(existing, candidate(), 'railpack'), existing);
  const blank = { candidateId: 'api', builder: '', dockerfilePath: '', port: '', buildCommand: '', startCommand: '' };
  const filled = fillEmptyRecommendations(blank, candidate(), 'railpack');
  assert.equal(filled.port, '8080');
  assert.equal(filled.builder, 'railpack');
  assert.equal(filled.startCommand, 'node dist/index.js');
});

test('saving review rejects an obsolete candidate, unsupported analysis, and unfinished job', () => {
  const draft = { candidateId: 'api', builder: 'railpack', dockerfilePath: '', port: '', buildCommand: '', startCommand: '' };
  assert.throws(() => reviewAnswers(job(), { ...draft, candidateId: 'missing' }), /Select a service candidate/);
  assert.throws(() => reviewAnswers({ ...job(), status: 'RUNNING' }, draft), /completed analysis/);
  assert.throws(() => reviewAnswers({ ...job(), analysisStatus: 'unsupported' }, draft), /completed analysis/);
  assert.throws(() => reviewAnswers({ ...job(), analysisStatus: undefined, analysisResult: { services: [candidate()], status: 'unsupported' } }, draft), /completed analysis/);
});

test('review requires an explicit builder and a repository-relative Dockerfile choice', () => {
  const draft = { candidateId: 'api', builder: '', dockerfilePath: '', port: '', buildCommand: '', startCommand: '' };
  assert.throws(() => reviewAnswers(job(), draft), /Choose a builder/);
  assert.throws(() => reviewAnswers(job(), { ...draft, builder: 'dockerfile' }), /Dockerfile path/);
});

test('review keeps empty settings omitted and validates integer ports before any request', () => {
  const draft = { candidateId: 'api', builder: 'railpack', dockerfilePath: '', port: '', buildCommand: ' ', startCommand: '' };
  assert.deepEqual(reviewAnswers(job(), draft), { analysisId: 'analysis-1', serviceCandidateId: 'api', builder: 'railpack' });
  for (const port of ['0', '-1', '65536', '8.5', 'not a port']) assert.throws(() => reviewAnswers(job(), { ...draft, port }), /Port must be an integer/);
  assert.equal(reviewAnswers(job(), { ...draft, port: '65535' }).port, 65535);
});

test('stale source review keeps a recognizable error for rerun guidance', async () => {
  globalThis.fetch = async () => respond(409, { success: false, code: 'ANALYSIS_STALE', message: 'Source changed' });
  await assert.rejects(analysis.answerAnalysis(7, { analysisId: 'analysis-1', serviceCandidateId: 'api', builder: 'railpack' }), (error) => {
    assert.match(api.describeError(error), /Run analysis again/);
    return true;
  });
});

 test('nested Dockerfile advice follows the selected root and leaves multiple paths for review', () => {
  const output = { ...job(), rootDirectory: '.', sourceReadiness: { buildTargets: [
    { contextPath: 'api', dockerfilePath: 'api/Dockerfile' },
    { contextPath: 'web', dockerfilePath: 'web/Dockerfile' }
  ] } };
  assert.deepEqual(candidateBuildAdvice(output, candidate('api', 'api')), { builder: 'dockerfile', dockerfilePath: 'Dockerfile' });
  output.sourceReadiness.buildTargets.push({ contextPath: 'api', dockerfilePath: 'api/Dockerfile.dev' });
  assert.deepEqual(candidateBuildAdvice(output, candidate('api', 'api')), { builder: 'dockerfile' });
});
 test('no-build sentinel is never filled as a runnable build command', () => {
 const selected = candidate();
 selected.buildCommand.value = 'none';
 const empty = { candidateId: 'api', builder: '', dockerfilePath: '', port: '', buildCommand: '', startCommand: '' };
 assert.equal(fillEmptyRecommendations(empty, selected, 'railpack').buildCommand, '');
});

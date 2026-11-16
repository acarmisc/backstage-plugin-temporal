/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Writes the fake data served by scripts/capture-screenshots.mjs into scripts/fake-data/ (committed).
// Needs the temporal-common build: `yarn workspace @acarmisc/backstage-plugin-temporal-common build`
// (or `yarn build`) first. Times hang off a fixed anchor, so the output is the same on every run.
// FAKE_NOW=<ISO time> moves the anchor. Relative labels in the UI ("in 3h") are right near the anchor;
// regenerate with a new FAKE_NOW when they have drifted.
//
//   node scripts/gen-fake-data.mjs

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWorkflowYaml } from '../plugins/temporal-common/dist/index.cjs.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'scripts', 'fake-data');
const fixtures = path.join(root, 'plugins', 'temporal-common', 'src', '__fixtures__', 'kbflow');
mkdirSync(out, { recursive: true });

const write = (name, data) => writeFileSync(path.join(out, name), `${JSON.stringify(data, null, 2)}\n`);
const parseFixture = name =>
  parseWorkflowYaml(readFileSync(path.join(fixtures, name), 'utf8'), { sourceName: name });

const NOW = Date.parse(process.env.FAKE_NOW ?? '2026-11-16T07:00:00Z');
const at = minutesAgo => new Date(NOW - minutesAgo * 60000).toISOString();
const ahead = minutes => new Date(NOW + minutes * 60000).toISOString();
const uuid = seed => {
  const h = createHash('sha256').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

// ---------------------------------------------------------------------------
// Clusters, streams and stream runs (the stream pages and the entity tab).
// ---------------------------------------------------------------------------

write('clusters.json', [{ name: 'staging', namespaces: ['kb'], uiBaseUrl: 'https://temporal.example.com' }]);

write('streams.json', [
  {
    name: 'crm-jira',
    schedule: { cron: '0 3 * * *', paused: false, nextRunTime: ahead(900) },
    lastRun: { workflowId: 'stream/crm-jira/20261114T030000', status: 'COMPLETED', startTime: '2026-11-14T03:00:00Z', closeTime: '2026-11-14T03:12:45Z', durationSeconds: 765 },
    lastSuccess: { workflowId: 'stream/crm-jira/20261114T030000', status: 'COMPLETED', startTime: '2026-11-14T03:00:00Z', closeTime: '2026-11-14T03:12:45Z', durationSeconds: 765 },
    recentStatuses: ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED'],
  },
  {
    name: 'wiki-kb',
    schedule: { cron: '0 4 * * *', paused: false, nextRunTime: ahead(1080) },
    lastRun: { workflowId: 'stream/wiki-kb/20261114T040000', status: 'COMPLETED', startTime: '2026-11-14T04:00:00Z', closeTime: '2026-11-14T04:08:12Z', durationSeconds: 492 },
    lastSuccess: { workflowId: 'stream/wiki-kb/20261114T040000', status: 'COMPLETED', startTime: '2026-11-14T04:00:00Z', closeTime: '2026-11-14T04:08:12Z', durationSeconds: 492 },
    recentStatuses: ['COMPLETED', 'COMPLETED', 'FAILED', 'COMPLETED', 'COMPLETED'],
  },
  {
    name: 'ces-ai-kb',
    schedule: { cron: '0 */6 * * *', paused: false, nextRunTime: ahead(30) },
    lastRun: { workflowId: 'stream/ces-ai-kb/20261114T120000', status: 'RUNNING', startTime: '2026-11-14T12:00:00Z', durationSeconds: 1842 },
    lastSuccess: { workflowId: 'stream/ces-ai-kb/20261113T180000', status: 'COMPLETED', startTime: '2026-11-13T18:00:00Z', closeTime: '2026-11-13T18:22:10Z', durationSeconds: 1330 },
    recentStatuses: ['RUNNING', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'FAILED'],
  },
  {
    name: 'wiki-evidence',
    schedule: { paused: true },
    lastRun: { workflowId: 'stream/wiki-evidence/20261110T030000', status: 'COMPLETED', startTime: '2026-11-10T03:00:00Z', closeTime: '2026-11-10T03:04:18Z', durationSeconds: 258 },
    lastSuccess: { workflowId: 'stream/wiki-evidence/20261110T030000', status: 'COMPLETED', startTime: '2026-11-10T03:00:00Z', closeTime: '2026-11-10T03:04:18Z', durationSeconds: 258 },
    recentStatuses: ['COMPLETED', 'COMPLETED', 'COMPLETED'],
  },
  {
    name: 'product-kb',
    schedule: { cron: '30 2 * * *', paused: false, nextRunTime: ahead(900) },
    lastRun: { workflowId: 'stream/product-kb/20261113T023000', status: 'FAILED', startTime: '2026-11-13T02:30:00Z', closeTime: '2026-11-13T02:31:02Z', durationSeconds: 62 },
    lastSuccess: { workflowId: 'stream/product-kb/20261112T023000', status: 'COMPLETED', startTime: '2026-11-12T02:30:00Z', closeTime: '2026-11-12T02:41:00Z', durationSeconds: 660 },
    recentStatuses: ['FAILED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED'],
  },
]);

write('runs-ces-ai-kb.json', [
  { workflowId: 'stream/ces-ai-kb/20261114T120000', status: 'RUNNING', startTime: '2026-11-14T12:00:00Z', durationSeconds: 1842 },
  { workflowId: 'stream/ces-ai-kb/20261113T180000', status: 'COMPLETED', startTime: '2026-11-13T18:00:00Z', closeTime: '2026-11-13T18:22:10Z', durationSeconds: 1330 },
  { workflowId: 'stream/ces-ai-kb/20261113T120000', status: 'COMPLETED', startTime: '2026-11-13T12:00:00Z', closeTime: '2026-11-13T12:19:40Z', durationSeconds: 1180 },
  { workflowId: 'stream/ces-ai-kb/20261113T060000', status: 'FAILED', startTime: '2026-11-13T06:00:00Z', closeTime: '2026-11-13T06:04:12Z', durationSeconds: 252 },
  { workflowId: 'stream/ces-ai-kb/20261113T000000', status: 'COMPLETED', startTime: '2026-11-13T00:00:00Z', closeTime: '2026-11-13T00:21:05Z', durationSeconds: 1265 },
]);

const kbGraph = parseFixture('jira-kb.yaml');
write('run-detail.json', {
  workflowId: 'stream/ces-ai-kb/20261114T120000',
  status: 'RUNNING',
  startTime: '2026-11-14T12:00:00Z',
  stream: 'ces-ai-kb',
  graph: kbGraph,
  stages: [
    { stage: 'clone-kb', state: 'ok', exit: 0, seconds: 12, tail: 'Cloned https://git.example.com/docs/ces-ai-kb.git @ main', optional: false },
    { stage: 'preflight', state: 'ok', exit: 0, seconds: 8, tail: 'preflight ok: 142 files', optional: false },
    { stage: 'capture', state: 'running', attempt: 1, optional: false },
    { stage: 'validate', state: 'pending', optional: false },
    { stage: 'graph', state: 'pending', optional: false },
    { stage: 'kb-sync', state: 'pending', optional: false },
    { stage: 'quality', state: 'pending', optional: false },
    { stage: 'publish', state: 'pending', optional: false },
  ],
  uiUrl: 'https://temporal.example.com/namespaces/kb/workflows/stream/ces-ai-kb/20261114T120000',
});
write('run-detail-completed.json', {
  workflowId: 'stream/crm-jira/20261114T030000',
  status: 'COMPLETED',
  startTime: '2026-11-14T03:00:00Z',
  closeTime: '2026-11-14T03:12:45Z',
  durationSeconds: 765,
  stream: 'crm-jira',
  graph: kbGraph,
  stages: kbGraph.nodes.map((n, i) => ({
    stage: n.id,
    state: 'ok',
    exit: 0,
    seconds: 30 + i * 17,
    tail: `${n.label} finished successfully`,
    optional: n.optional === true,
  })),
  uiUrl: 'https://temporal.example.com/namespaces/kb/workflows/stream/crm-jira/20261114T030000',
});

// ---------------------------------------------------------------------------
// Definitions (the definition page and the entity tab's diagram).
// ---------------------------------------------------------------------------

write('definition-jira.json', kbGraph);
write('definition-ms.json', parseFixture('multisource-dag.yaml'));

// The catalog entity behind /catalog/default/component/demo-stream (entity tab and card).
write('catalog-entity.json', {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'demo-stream',
    namespace: 'default',
    uid: uuid('demo-stream'),
    etag: uuid('demo-stream-etag'),
    title: 'Demo stream',
    description: 'Knowledge-base ingest stream for the Temporal plugin screenshots',
    annotations: {
      'temporal.io/cluster': 'staging',
      'temporal.io/namespace': 'kb',
      'temporal.io/stream': 'ces-ai-kb',
      'temporal.io/definition-location': 'http://example.com/jira-kb.yaml',
    },
  },
  spec: { type: 'service', lifecycle: 'production', owner: 'team-a' },
  relations: [],
});

// ---------------------------------------------------------------------------
// Workflow browser: executions, their histories, and the schedules that start some of them.
//
// History events copy the backend's shape (toHistoryEvent): the event type is the protobuf
// attribute name without "EventAttributes", and the attributes are the plain JSON fields.
// ---------------------------------------------------------------------------

/** Appends events in the order the SDK would record them. `secs` is the time each event takes. */
class History {
  constructor(startIso) {
    this.t = Date.parse(startIso);
    this.events = [];
    this.lastWft = undefined;
  }

  add(eventType, attributes, secs = 1) {
    this.t += secs * 1000;
    const eventId = this.events.length + 1;
    this.events.push({ eventId, eventTime: new Date(this.t).toISOString(), eventType, attributes });
    return eventId;
  }

  start(workflowType, input) {
    this.add('WorkflowExecutionStarted', { workflowType: { name: workflowType }, taskQueue: { name: 'kb-queue' }, input: [input], attempt: 1 }, 0);
  }

  wft() {
    const scheduledEventId = this.add('WorkflowTaskScheduled', { taskQueue: { name: 'kb-queue' }, attempt: 1 });
    const startedEventId = this.add('WorkflowTaskStarted', { scheduledEventId, identity: 'kb-worker-7f9c' });
    this.lastWft = this.add('WorkflowTaskCompleted', { scheduledEventId, startedEventId, identity: 'kb-worker-7f9c' });
  }

  /** One activity. `open` stops early: 'queued' (no worker yet) or 'running' (started, not closed). */
  activity(stage, { secs = 20, attempt = 1, result, fail, timeout, canceled, open } = {}) {
    const scheduledEventId = this.add('ActivityTaskScheduled', {
      workflowTaskCompletedEventId: this.lastWft,
      activityId: String(this.events.length + 1),
      activityType: { name: stage },
      taskQueue: { name: 'kb-queue' },
      input: [{ stage, project: 'KB' }],
      scheduleToCloseTimeout: '3600s',
      startToCloseTimeout: '600s',
      retryPolicy: { initialInterval: '5s', backoffCoefficient: 2, maximumInterval: '120s', maximumAttempts: 5 },
    });
    if (open === 'queued') return;
    const startedEventId = this.add('ActivityTaskStarted', { scheduledEventId, attempt, identity: 'kb-worker-7f9c' });
    if (open === 'running') return;
    if (canceled) {
      const latestCancelRequestedEventId = this.add('ActivityTaskCancelRequested', { scheduledEventId, workflowTaskCompletedEventId: this.lastWft }, secs);
      this.add('ActivityTaskCanceled', { scheduledEventId, startedEventId, latestCancelRequestedEventId, details: [] });
    } else if (timeout) {
      this.add('ActivityTaskTimedOut', {
        scheduledEventId,
        startedEventId,
        retryState: 'RETRY_STATE_TIMEOUT',
        failure: { message: 'activity StartToClose timeout', source: 'Server', timeoutFailureInfo: { timeoutType: 'TIMEOUT_TYPE_START_TO_CLOSE' } },
      }, secs);
    } else if (fail) {
      this.add('ActivityTaskFailed', {
        scheduledEventId,
        startedEventId,
        retryState: fail.retryState,
        failure: { message: fail.message, source: 'Worker', applicationFailureInfo: { type: 'HttpError', nonRetryable: fail.retryState === 'RETRY_STATE_NON_RETRYABLE_FAILURE' } },
      }, secs);
    } else {
      this.add('ActivityTaskCompleted', { scheduledEventId, startedEventId, result: [result] }, secs);
    }
  }

  timer(timerId, secs, { fired = true } = {}) {
    const startedEventId = this.add('TimerStarted', { timerId, startToFireTimeout: `${secs}s`, workflowTaskCompletedEventId: this.lastWft });
    if (fired) this.add('TimerFired', { timerId, startedEventId }, secs);
  }

  /** Child workflow. The SDK names the first event StartChildWorkflowExecutionInitiated. */
  child(workflowType, secs, result) {
    const initiatedEventId = this.add('StartChildWorkflowExecutionInitiated', {
      workflowId: `${workflowType}-shard-0`,
      workflowType: { name: workflowType },
      taskQueue: { name: 'kb-queue' },
      workflowTaskCompletedEventId: this.lastWft,
    });
    const startedEventId = this.add('ChildWorkflowExecutionStarted', { initiatedEventId, workflowType: { name: workflowType } });
    this.add('ChildWorkflowExecutionCompleted', { initiatedEventId, startedEventId, result: [result] }, secs);
  }

  signal(signalName, approvedBy) {
    this.add('WorkflowExecutionSignaled', { signalName, input: [{ approvedBy }], identity: 'kb-ops-cli' });
  }

  end(eventType, attributes) {
    this.add(eventType, { workflowTaskCompletedEventId: this.lastWft, ...attributes });
  }
}

const jiraRateLimit = '429 Too Many Requests from the embeddings API (retry budget exhausted after 5 attempts)';
const crmToken = '401 Unauthorized: CRM API token expired';
const jiraStep = (h, embedSecs, embedAttempt) => {
  h.wft();
  h.activity('fetchIssues', { secs: 412, result: { stage: 'fetchIssues', status: 'ok', exit: 0, seconds: 412, tail: '1284 issues fetched from KB' } });
  h.wft();
  h.activity('embedChunks', { secs: embedSecs, attempt: embedAttempt, result: { stage: 'embedChunks', status: 'ok', exit: 0, seconds: embedSecs, tail: '9120 chunks embedded' } });
};

/** One entry per execution. `build` writes its history; the rest is derived from it. */
const RUNS = [
  {
    type: 'IngestJira', status: 'RUNNING', ago: 60, schedule: 'jira-sync',
    input: { project: 'KB', since: at(180) },
    build(h) {
      jiraStep(h, 1150, 3);
      h.wft();
      h.timer('throttle-5m', 300);
      h.wft();
      h.activity('publishIndex', { open: 'running' });
      h.activity('notifySlack', { open: 'queued' });
    },
  },
  {
    type: 'IngestJira', status: 'COMPLETED', ago: 180, schedule: 'jira-sync',
    input: { project: 'KB', since: at(360) },
    result: { issues: 1284, chunks: 9120 },
    build(h) {
      jiraStep(h, 1100, 3);
      h.wft();
      h.timer('throttle-5m', 300);
      h.wft();
      h.activity('publishIndex', { secs: 180, result: { stage: 'publishIndex', status: 'ok', exit: 0, seconds: 180, tail: 'index kb-jira swapped' } });
      h.wft();
      h.activity('notifySlack', { secs: 3, result: { stage: 'notifySlack', status: 'ok', exit: 0, seconds: 3, tail: 'posted to #kb-ingest' } });
      h.end('WorkflowExecutionCompleted', { result: [{ issues: 1284, chunks: 9120 }] });
    },
  },
  {
    type: 'IngestJira', status: 'COMPLETED', ago: 300, schedule: 'jira-sync',
    input: { project: 'KB', since: at(480) },
    result: { issues: 41, chunks: 260 },
    build(h) {
      jiraStep(h, 95, 1);
      h.wft();
      h.timer('throttle-5m', 300);
      h.wft();
      h.activity('publishIndex', { secs: 60, result: { stage: 'publishIndex', status: 'ok', exit: 0, seconds: 60, tail: 'index kb-jira swapped' } });
      h.end('WorkflowExecutionCompleted', { result: [{ issues: 41, chunks: 260 }] });
    },
  },
  {
    type: 'IngestJira', status: 'FAILED', ago: 420, schedule: 'jira-sync',
    input: { project: 'KB', since: at(600) },
    failure: `embedChunks failed: ${jiraRateLimit}`,
    build(h) {
      h.wft();
      h.activity('fetchIssues', { secs: 380, result: { stage: 'fetchIssues', status: 'ok', exit: 0, seconds: 380, tail: '611 issues fetched from KB' } });
      h.wft();
      h.activity('embedChunks', { secs: 260, attempt: 5, fail: { message: jiraRateLimit, retryState: 'RETRY_STATE_MAXIMUM_ATTEMPTS_REACHED' } });
      h.end('WorkflowExecutionFailed', { failure: { message: `embedChunks failed: ${jiraRateLimit}`, source: 'Worker' }, retryState: 'RETRY_STATE_MAXIMUM_ATTEMPTS_REACHED' });
    },
  },
  {
    type: 'IngestConfluence', status: 'COMPLETED', ago: 45, schedule: 'confluence-hourly',
    input: { space: 'ENG' },
    result: { pages: 412 },
    build(h) {
      h.wft();
      h.activity('crawlSpaces', { secs: 150, result: { stage: 'crawlSpaces', status: 'ok', exit: 0, seconds: 150, tail: '412 pages crawled' } });
      h.wft();
      h.activity('indexPages', { secs: 40, result: { stage: 'indexPages', status: 'ok', exit: 0, seconds: 40, tail: 'indexed 412 pages' } });
      h.end('WorkflowExecutionCompleted', { result: [{ pages: 412 }] });
    },
  },
  {
    type: 'IngestConfluence', status: 'COMPLETED', ago: 105, schedule: 'confluence-hourly',
    input: { space: 'ENG' },
    result: { pages: 58 },
    build(h) {
      h.wft();
      h.activity('crawlSpaces', { secs: 130, result: { stage: 'crawlSpaces', status: 'ok', exit: 0, seconds: 130, tail: '58 pages crawled' } });
      h.wft();
      h.activity('indexPages', { secs: 30, result: { stage: 'indexPages', status: 'ok', exit: 0, seconds: 30, tail: 'indexed 58 pages' } });
      h.end('WorkflowExecutionCompleted', { result: [{ pages: 58 }] });
    },
  },
  {
    type: 'IngestConfluence', status: 'CANCELED', ago: 165, schedule: 'confluence-hourly',
    input: { space: 'ARCH' },
    build(h) {
      h.wft();
      h.activity('crawlSpaces', { secs: 40, canceled: true });
      h.end('WorkflowExecutionCanceled', { details: [] });
    },
  },
  {
    type: 'IngestConfluence', status: 'TIMED_OUT', ago: 900,
    input: { space: 'ARCH' },
    build(h) {
      h.wft();
      h.activity('loadSpaces', { secs: 10, result: { stage: 'loadSpaces', status: 'ok', exit: 0, seconds: 10, tail: '3 spaces' } });
      h.wft();
      h.activity('crawlSpaces', { secs: 600, timeout: true });
      h.end('WorkflowExecutionTimedOut', { retryState: 'RETRY_STATE_TIMEOUT' });
    },
  },
  {
    type: 'ReindexKb', status: 'COMPLETED', ago: 1860, schedule: 'reindex-weekly',
    input: { index: 'kb-jira', mode: 'full' },
    result: { indexed: 9120 },
    build(h) {
      h.wft();
      h.child('ShardReindex', 900, { shard: 0, documents: 9120 });
      h.wft();
      h.timer('verify-delay', 60);
      h.wft();
      h.activity('swapIndexAlias', { secs: 5, result: { stage: 'swapIndexAlias', status: 'ok', exit: 0, seconds: 5, tail: 'alias kb-jira -> kb-jira-v7' } });
      h.end('WorkflowExecutionCompleted', { result: [{ indexed: 9120 }] });
    },
  },
  {
    type: 'ReindexKb', status: 'TERMINATED', ago: 2880,
    input: { index: 'kb-wiki', mode: 'full' },
    build(h) {
      h.wft();
      h.activity('buildIndex', { secs: 600, result: { stage: 'buildIndex', status: 'ok', exit: 0, seconds: 600, tail: 'built kb-wiki-v8' } });
      h.wft();
      h.activity('swapIndexAlias', { open: 'queued' });
      h.end('WorkflowExecutionTerminated', { reason: 'Superseded by the full reindex on Sunday', identity: 'kb-ops-cli' });
    },
  },
  {
    type: 'CrmSync', status: 'COMPLETED', ago: 1440,
    input: { account: 'all' },
    result: { contacts: 3120 },
    build(h) {
      h.wft();
      h.activity('pullCrm', { secs: 310, attempt: 2, result: { stage: 'pullCrm', status: 'ok', exit: 0, seconds: 310, tail: '3120 contacts' } });
      h.wft();
      h.activity('pushCrm', { secs: 210, result: { stage: 'pushCrm', status: 'ok', exit: 0, seconds: 210, tail: 'pushed 3120 contacts' } });
      h.end('WorkflowExecutionCompleted', { result: [{ contacts: 3120 }] });
    },
  },
  {
    type: 'CrmSync', status: 'FAILED', ago: 110,
    input: { account: 'emea' },
    failure: crmToken,
    build(h) {
      h.wft();
      h.activity('pullCrm', { secs: 95, fail: { message: crmToken, retryState: 'RETRY_STATE_NON_RETRYABLE_FAILURE' } });
      h.end('WorkflowExecutionFailed', { failure: { message: crmToken, source: 'Worker' }, retryState: 'RETRY_STATE_NON_RETRYABLE_FAILURE' });
    },
  },
  {
    type: 'CrmSync', status: 'RUNNING', ago: 30,
    input: { account: 'amer' },
    build(h) {
      h.wft();
      h.activity('pullCrm', { secs: 120, result: { stage: 'pullCrm', status: 'ok', exit: 0, seconds: 120, tail: '1407 contacts' } });
      h.wft();
      h.signal('approve-push', 'kb-ops');
      h.wft();
      h.activity('pushCrm', { open: 'running' });
    },
  },
  {
    type: 'EvidenceExtract', status: 'COMPLETED', ago: 9000, schedule: 'wiki-evidence-weekly',
    input: { space: 'WIKI' },
    result: { claims: 640 },
    build(h) {
      h.wft();
      h.activity('extractPages', { secs: 500, result: { stage: 'extractPages', status: 'ok', exit: 0, seconds: 500, tail: '640 claims' } });
      h.wft();
      h.timer('cooldown', 120);
      h.wft();
      h.activity('indexEvidence', { secs: 200, result: { stage: 'indexEvidence', status: 'ok', exit: 0, seconds: 200, tail: 'indexed 640 claims' } });
      h.end('WorkflowExecutionCompleted', { result: [{ claims: 640 }] });
    },
  },
];

const workflowRows = [];
const workflowDetails = {};
for (const run of RUNS) {
  const startMs = NOW - run.ago * 60000;
  const startTime = new Date(startMs).toISOString();
  const h = new History(startTime);
  h.start(run.type, run.input);
  run.build(h);
  const closed = run.status !== 'RUNNING';
  const runId = uuid(`${run.type}-${startTime}`);
  const workflowId = `${run.type}-${startTime.replace('.000Z', 'Z')}`;
  const summary = {
    namespace: 'kb',
    workflowId,
    runId,
    workflowType: run.type,
    taskQueue: 'kb-queue',
    status: run.status,
    startTime,
    ...(closed ? { closeTime: new Date(h.t).toISOString(), durationSeconds: Math.round((h.t - startMs) / 1000) } : {}),
    ...(run.schedule ? { scheduledBy: run.schedule } : {}),
  };
  workflowRows.push(summary);
  workflowDetails[runId] = {
    detail: {
      ...summary,
      historyLength: h.events.length,
      memo: { owner: 'kb-team' },
      searchAttributes: run.schedule ? { TemporalScheduledById: run.schedule } : {},
      input: run.input,
      result: run.result,
      failure: run.failure,
      uiUrl: `https://temporal.example.com/namespaces/kb/workflows/${workflowId}/${runId}/history`,
    },
    history: { truncated: false, events: h.events },
  };
}
workflowRows.sort((a, b) => b.startTime.localeCompare(a.startTime));
write('workflows.json', { workflows: workflowRows });
write('workflow-details.json', workflowDetails);

// Schedules. Recent actions are the runs each schedule started (scheduledBy); the list is the
// same data in the list shape.
const SCHEDULES = {
  'jira-sync': {
    spec: { cronExpressions: ['0 */2 * * *'], timezone: 'UTC' },
    paused: false, overlapPolicy: 'SKIP', workflowType: 'IngestJira',
    nextActionTimes: [ahead(60), ahead(180), ahead(300)],
  },
  'confluence-hourly': {
    // The backend sends interval durations as milliseconds, e.g. "3600000ms".
    spec: { intervals: [{ every: '3600000ms', offset: '900000ms' }], timezone: 'UTC' },
    paused: false, overlapPolicy: 'BUFFER_ONE', workflowType: 'IngestConfluence',
    nextActionTimes: [ahead(15), ahead(75), ahead(135)],
  },
  'reindex-weekly': {
    spec: { cronExpressions: ['0 2 * * 0'], timezone: 'UTC' },
    paused: false, overlapPolicy: 'SKIP', workflowType: 'ReindexKb',
    nextActionTimes: [ahead(8220)],
  },
  'wiki-evidence-weekly': {
    spec: { cronExpressions: ['0 3 * * 1'], timezone: 'UTC' },
    paused: true, note: 'Paused until the evidence index migration (KB-412) is done',
    overlapPolicy: 'SKIP', workflowType: 'EvidenceExtract',
    nextActionTimes: [],
  },
};
const scheduleList = [];
const scheduleDetails = {};
for (const [scheduleId, s] of Object.entries(SCHEDULES)) {
  const actions = workflowRows.filter(w => w.scheduledBy === scheduleId);
  const last = actions[0];
  const { spec, paused, note, overlapPolicy, workflowType, nextActionTimes } = s;
  scheduleDetails[scheduleId] = {
    scheduleId, paused, ...(note ? { note } : {}), spec, overlapPolicy, workflowType,
    recentActions: actions.map(w => ({ scheduledAt: w.startTime, takenAt: w.startTime, workflowId: w.workflowId, runId: w.runId })),
    nextActionTimes,
  };
  scheduleList.push({
    scheduleId, paused, ...(note ? { note } : {}), workflowType, spec, nextActionTimes,
    lastActionAt: last?.startTime,
    ...(last ? { lastRun: { workflowId: last.workflowId, runId: last.runId, status: last.status, startTime: last.startTime } } : {}),
  });
}
write('schedules.json', { schedules: scheduleList });
write('schedule-details.json', scheduleDetails);

console.log(`fake data written to ${out}`);

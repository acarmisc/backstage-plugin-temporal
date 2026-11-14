import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseWorkflowYaml } from '../plugins/temporal-common/dist/index.cjs.js';

const out = '/tmp/scratchpad/fake-data';
mkdirSync(out, { recursive: true });

// Clusters
const clusters = [{ name: 'staging', namespaces: ['kb'], uiBaseUrl: 'https://temporal.example.com' }];
writeFileSync(`${out}/clusters.json`, JSON.stringify(clusters));

// Streams
const streams = [
  {
    name: 'crm-jira',
    schedule: { cron: '0 3 * * *', paused: false, nextRunTime: new Date(Date.now() + 3600000).toISOString() },
    lastRun: { workflowId: 'stream/crm-jira/20261114T030000', status: 'COMPLETED', startTime: '2026-11-14T03:00:00Z', closeTime: '2026-11-14T03:12:45Z', durationSeconds: 765 },
    lastSuccess: { workflowId: 'stream/crm-jira/20261114T030000', status: 'COMPLETED', startTime: '2026-11-14T03:00:00Z', closeTime: '2026-11-14T03:12:45Z', durationSeconds: 765 },
    recentStatuses: ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED'],
  },
  {
    name: 'wiki-kb',
    schedule: { cron: '0 4 * * *', paused: false, nextRunTime: new Date(Date.now() + 7200000).toISOString() },
    lastRun: { workflowId: 'stream/wiki-kb/20261114T040000', status: 'COMPLETED', startTime: '2026-11-14T04:00:00Z', closeTime: '2026-11-14T04:08:12Z', durationSeconds: 492 },
    lastSuccess: { workflowId: 'stream/wiki-kb/20261114T040000', status: 'COMPLETED', startTime: '2026-11-14T04:00:00Z', closeTime: '2026-11-14T04:08:12Z', durationSeconds: 492 },
    recentStatuses: ['COMPLETED', 'COMPLETED', 'FAILED', 'COMPLETED', 'COMPLETED'],
  },
  {
    name: 'ces-ai-kb',
    schedule: { cron: '0 */6 * * *', paused: false, nextRunTime: new Date(Date.now() + 1800000).toISOString() },
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
    schedule: { cron: '30 2 * * *', paused: false, nextRunTime: new Date(Date.now() + 54000000).toISOString() },
    lastRun: { workflowId: 'stream/product-kb/20261113T023000', status: 'FAILED', startTime: '2026-11-13T02:30:00Z', closeTime: '2026-11-13T02:31:02Z', durationSeconds: 62 },
    lastSuccess: { workflowId: 'stream/product-kb/20261112T023000', status: 'COMPLETED', startTime: '2026-11-12T02:30:00Z', closeTime: '2026-11-12T02:41:00Z', durationSeconds: 660 },
    recentStatuses: ['FAILED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED'],
  },
];
writeFileSync(`${out}/streams.json`, JSON.stringify(streams));

// Runs for ces-ai-kb
const runs = [
  { workflowId: 'stream/ces-ai-kb/20261114T120000', status: 'RUNNING', startTime: '2026-11-14T12:00:00Z', durationSeconds: 1842 },
  { workflowId: 'stream/ces-ai-kb/20261113T180000', status: 'COMPLETED', startTime: '2026-11-13T18:00:00Z', closeTime: '2026-11-13T18:22:10Z', durationSeconds: 1330 },
  { workflowId: 'stream/ces-ai-kb/20261113T120000', status: 'COMPLETED', startTime: '2026-11-13T12:00:00Z', closeTime: '2026-11-13T12:19:40Z', durationSeconds: 1180 },
  { workflowId: 'stream/ces-ai-kb/20261113T060000', status: 'FAILED', startTime: '2026-11-13T06:00:00Z', closeTime: '2026-11-13T06:04:12Z', durationSeconds: 252 },
  { workflowId: 'stream/ces-ai-kb/20261113T000000', status: 'COMPLETED', startTime: '2026-11-13T00:00:00Z', closeTime: '2026-11-13T00:21:05Z', durationSeconds: 1265 },
];
writeFileSync(`${out}/runs-ces-ai-kb.json`, JSON.stringify(runs));

// Run detail for the running one
const graph = parseWorkflowYaml(readFileSync('/Users/andrea/Projects/personal/backstage-plugin-temporal/plugins/temporal-common/src/__fixtures__/kbflow/jira-kb.yaml', 'utf8'), { sourceName: 'jira-kb.yaml' });
const runDetail = {
  workflowId: 'stream/ces-ai-kb/20261114T120000',
  status: 'RUNNING',
  startTime: '2026-11-14T12:00:00Z',
  stream: 'ces-ai-kb',
  graph,
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
};
writeFileSync(`${out}/run-detail.json`, JSON.stringify(runDetail));

// Run detail for a completed run (crm-jira) using multisource-dag fixture? use jira-kb
const completedGraph = parseWorkflowYaml(readFileSync('/Users/andrea/Projects/personal/backstage-plugin-temporal/plugins/temporal-common/src/__fixtures__/kbflow/jira-kb.yaml', 'utf8'), { sourceName: 'jira-kb.yaml' });
const completedDetail = {
  workflowId: 'stream/crm-jira/20261114T030000',
  status: 'COMPLETED',
  startTime: '2026-11-14T03:00:00Z',
  closeTime: '2026-11-14T03:12:45Z',
  durationSeconds: 765,
  stream: 'crm-jira',
  graph: completedGraph,
  stages: completedGraph.nodes.map((n, i) => ({
    stage: n.id,
    state: 'ok',
    exit: 0,
    seconds: 30 + i * 17,
    tail: `${n.label} finished successfully`,
    optional: n.optional === true,
  })),
  uiUrl: 'https://temporal.example.com/namespaces/kb/workflows/stream/crm-jira/20261114T030000',
};
writeFileSync(`${out}/run-detail-completed.json`, JSON.stringify(completedDetail));

// Definition graph from multisource fixture
const msGraph = parseWorkflowYaml(readFileSync('/Users/andrea/Projects/personal/backstage-plugin-temporal/plugins/temporal-common/src/__fixtures__/kbflow/multisource-dag.yaml', 'utf8'), { sourceName: 'multisource-dag.yaml' });
writeFileSync(`${out}/definition-ms.json`, JSON.stringify(msGraph));

// Also a single-source definition (jira-kb) for the definition page screenshot
writeFileSync(`${out}/definition-jira.json`, JSON.stringify(completedGraph));

console.log('fake data written to', out);

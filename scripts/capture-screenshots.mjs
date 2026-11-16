/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

// Screenshots of the plugin pages in the dev app. Every /api/temporal and catalog call is served
// from scripts/fake-data/ (generate it with scripts/gen-fake-data.mjs), so no Temporal cluster or
// catalog location is needed. Start the dev app first (see README, "Regenerating screenshots").
//
//   node scripts/capture-screenshots.mjs
//
// Env: BASE_URL (default http://localhost:3000), PLAYWRIGHT_MODULE (default 'playwright'),
// CHROME_PATH (default: the macOS Google Chrome app).

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');

const here = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = path.join(here, '..', 'docs', 'images');
const DATA = path.join(here, 'fake-data');
const load = name => JSON.parse(readFileSync(path.join(DATA, name), 'utf8'));

const clusters = load('clusters.json');
const streams = load('streams.json');
const runsCes = load('runs-ces-ai-kb.json');
const runDetails = { running: load('run-detail.json'), completed: load('run-detail-completed.json') };
const definitions = { jira: load('definition-jira.json'), multisource: load('definition-ms.json') };
const catalogEntity = load('catalog-entity.json');
const workflows = load('workflows.json');
const workflowDetails = load('workflow-details.json');
const schedules = load('schedules.json');
const scheduleDetails = load('schedule-details.json');

const json = (route, body, status = 200) =>
  route.fulfill({ status, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const notMocked = route => json(route, { error: 'not mocked' }, 404);

/** Answers one /api/temporal call from the fake data. More specific paths are checked first. */
function serveTemporal(route, url) {
  const p = url.pathname;
  let m;
  if (p.endsWith('/clusters')) return json(route, clusters);
  if (p.endsWith('/schedules')) return json(route, schedules);
  if ((m = p.match(/\/schedules\/([^/]+)$/))) {
    const detail = scheduleDetails[decodeURIComponent(m[1])];
    return detail ? json(route, detail) : notMocked(route);
  }
  // /workflows/<namespace>/<workflowId>/<runId>[/history]: the run id is the key.
  if ((m = p.match(/\/workflows\/[^/]+\/[^/]+\/([^/]+)(\/history)?$/))) {
    const entry = workflowDetails[m[1]];
    if (!entry) return notMocked(route);
    return json(route, m[2] ? entry.history : entry.detail);
  }
  if (p.endsWith('/workflows')) return json(route, workflows);
  if (/\/streams\/[^/]+\/runs$/.test(p)) return json(route, runsCes);
  if (p.includes('/runs/')) {
    const id = decodeURIComponent(p.split('/runs/')[1]);
    return json(route, id.includes('120000') ? runDetails.running : runDetails.completed);
  }
  if (p.endsWith('/streams')) return json(route, streams);
  if (p.endsWith('/definitions')) {
    const location = url.searchParams.get('location') || '';
    return json(route, location.includes('multisource') ? definitions.multisource : definitions.jira);
  }
  return notMocked(route);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 2 });

await page.route('**/api/temporal/**', route => serveTemporal(route, new URL(route.request().url())));
// The entity behind the entity tab. The catalog has no demo-stream, so its lookup is mocked.
await page.route('**/api/catalog/**', route => {
  const p = new URL(route.request().url()).pathname;
  if (p.endsWith('/entities/by-name/component/default/demo-stream')) return json(route, catalogEntity);
  return notMocked(route);
});

// Sign in as guest. Fail before any screenshot if the ENTER button is still there.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
const enter = page.locator('button').filter({ hasText: 'ENTER' }).first();
await enter.click();
await page.waitForTimeout(6000);
if (await enter.isVisible().catch(() => false)) throw new Error('Guest sign-in did not complete');
console.log('signed in');

// Text that means a page did not render its data. Printed, not fatal: the PNGs are checked by eye too.
const PROBLEM = /Entity not found|Could not load|not mocked|Temporal is unavailable|Missing temporal\.io/i;

async function shot(route, name, { wait = 3000 } = {}) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  const text = await page.innerText('body');
  const problem = text.match(PROBLEM);
  if (problem) console.warn(`WARN ${name}: page shows "${problem[0]}"`);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
  console.log('saved', name);
}

const wfUrl = w =>
  `/temporal/workflow?cluster=staging&namespace=kb&workflowId=${encodeURIComponent(w.workflowId)}&runId=${w.runId}`;
const find = (type, status, scheduledBy) =>
  workflows.workflows.find(
    w => w.workflowType === type && w.status === status && (scheduledBy === undefined || w.scheduledBy === scheduledBy),
  );

await shot('/temporal', 'streams');
await shot('/temporal/stream?cluster=staging&namespace=kb&name=ces-ai-kb', 'stream-running');
await shot('/temporal/stream?cluster=staging&namespace=kb&name=ces-ai-kb&run=stream/ces-ai-kb/20261113T180000', 'stream-completed');
await shot('/temporal/definition?location=http://example.com/jira-kb.yaml', 'definition');
await shot('/temporal/definition?location=http://example.com/multisource-dag.yaml', 'definition-dag');
await shot('/catalog/default/component/demo-stream/temporal', 'entity-tab', { wait: 4000 });
await shot('/temporal/workflows?cluster=staging&namespace=kb', 'workflows');
await shot(wfUrl(find('IngestJira', 'COMPLETED', 'jira-sync')), 'workflow-detail');
await shot(wfUrl(find('IngestJira', 'RUNNING', 'jira-sync')), 'workflow-running');
await shot(wfUrl(find('IngestJira', 'FAILED', 'jira-sync')), 'workflow-failed');
await shot(wfUrl(find('ReindexKb', 'COMPLETED', 'reindex-weekly')), 'workflow-reindex');

// Schedules last: the pages come from a separate change.
await shot('/temporal/schedules?cluster=staging&namespace=kb', 'schedules');
await shot('/temporal/schedule?cluster=staging&namespace=kb&scheduleId=jira-sync', 'schedule-detail');

await browser.close();
console.log('done');

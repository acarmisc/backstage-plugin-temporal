import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('/Users/andrea/gstack/node_modules/playwright');

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'images');
const DATA = '/tmp/scratchpad/fake-data';
const load = (n) => JSON.parse(readFileSync(`${DATA}/${n}`, 'utf8'));

const clusters = load('clusters.json');
const streams = load('streams.json');
const runsCes = load('runs-ces-ai-kb.json');
const runDetailRunning = load('run-detail.json');
const runDetailCompleted = load('run-detail-completed.json');
const defJira = load('definition-jira.json');
const defMs = load('definition-ms.json');

const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1480, height: 900 }, deviceScaleFactor: 2 });

page.on('request', r => { if (r.url().includes('/api/temporal')) console.log('REQ', r.method(), r.url().replace('http://localhost:7007','')); });

await page.route('**/api/temporal/**', async (route) => {
  const url = new URL(route.request().url());
  const p = url.pathname;
  const headers = { 'content-type': 'application/json' };
  if (p.endsWith('/clusters')) return route.fulfill({ status: 200, headers, body: JSON.stringify(clusters) });
  if (/\/streams\/[^/]+\/runs$/.test(p)) return route.fulfill({ status: 200, headers, body: JSON.stringify(runsCes) });
  if (/\/runs\//.test(p)) {
    const id = decodeURIComponent(p.split('/runs/')[1]);
    const data = id.includes('120000') ? runDetailRunning : runDetailCompleted;
    return route.fulfill({ status: 200, headers, body: JSON.stringify(data) });
  }
  if (p.endsWith('/streams')) return route.fulfill({ status: 200, headers, body: JSON.stringify(streams) });
  if (p.endsWith('/definitions')) {
    const loc = url.searchParams.get('location') || '';
    const data = loc.includes('multisource') ? defMs : defJira;
    return route.fulfill({ status: 200, headers, body: JSON.stringify(data) });
  }
  return route.fulfill({ status: 404, headers, body: '{"error":"not mocked"}' });
});

// Sign in as guest.
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(5000);
const btn = page.locator('button').filter({ hasText: 'ENTER' });
await btn.first().click();
await page.waitForTimeout(6000);
console.log('signed in, url=', page.url());

async function shot(route, name, wait = 3000) {
  await page.goto(BASE + route, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log('saved', name);
}

await shot('/temporal', 'streams');
await shot('/temporal/stream?cluster=staging&namespace=kb&name=ces-ai-kb', 'stream-running');
await shot('/temporal/stream?cluster=staging&namespace=kb&name=ces-ai-kb&run=stream/ces-ai-kb/20261113T180000', 'stream-completed');
await shot('/temporal/definition?location=http://example.com/jira-kb.yaml', 'definition');
await shot('/temporal/definition?location=http://example.com/multisource-dag.yaml', 'definition-dag');
await shot('/catalog/default/component/demo-stream/temporal', 'entity-tab');

await browser.close();
console.log('done');

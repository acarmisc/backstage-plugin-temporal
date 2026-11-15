/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { Content, Header, Page } from '@backstage/core-components';
import type {
  ScheduleDetail,
  WorkflowExecutionDetail,
  WorkflowHistoryResponse,
} from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { buildHistoryGraph } from './historyGraph';
import { formatDuration } from './format';
import { JsonViewer } from './JsonViewer';
import { RunStatusBadge } from './StatusBadge';
import { useIsDark } from './useIsDark';
import { useUrlParams, workflowLink, workflowsLink } from './links';
import { WorkflowDiagram } from './WorkflowDiagram';

const card = { border: '1px solid rgba(128,128,128,0.3)', borderRadius: 8, padding: 16, marginBottom: 16 };
const cell = { padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,0.25)', textAlign: 'left' as const };
const plainButton = { background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' };
const NOT_AVAILABLE = 'Not available (requires temporal.run.read)';

const when = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

function Chips({ items }: { items: [string, ReactNode][] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
      {items.map(([label, value]) => (
        <div key={label} style={{ border: '1px solid rgba(128,128,128,0.25)', borderRadius: 6, padding: '6px 10px', minWidth: 0 }}>
          <div style={{ fontSize: 11, opacity: 0.7, textTransform: 'uppercase' }}>{label}</div>
          <div style={{ wordBreak: 'break-all' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}

function Payload({ label, value, missing }: { label: string; value: unknown; missing: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <h3 style={{ fontSize: 14, margin: '0 0 6px' }}>{label}</h3>
      {value === undefined ? <p style={{ margin: 0, opacity: 0.7 }}>{missing}</p> : <JsonViewer value={value} />}
    </div>
  );
}

function ScheduleView({ schedule, cluster, namespace }: { schedule: ScheduleDetail; cluster: string; namespace: string }) {
  const { spec } = schedule;
  return (
    <>
      <Chips
        items={[
          ['Schedule ID', schedule.scheduleId],
          ['State', schedule.paused ? 'Paused' : 'Active'],
          ['Note', schedule.note ?? '—'],
          ['Cron', spec.cronExpressions?.join(', ') || '—'],
          ['Intervals', spec.intervals?.map(i => `every ${i.every}${i.offset ? ` offset ${i.offset}` : ''}`).join(', ') || '—'],
          ['Timezone', spec.timezone ?? '—'],
          ['Overlap policy', schedule.overlapPolicy ?? '—'],
          ['Workflow type', schedule.workflowType ?? '—'],
        ]}
      />
      {spec.calendars && spec.calendars.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Payload label="Calendar specs" value={spec.calendars} missing={NOT_AVAILABLE} />
        </div>
      )}
      <h3 style={{ fontSize: 14 }}>Recent actions</h3>
      {schedule.recentActions.length === 0 ? (
        <p>No actions yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={cell}>Scheduled at</th>
              <th style={cell}>Taken at</th>
              <th style={cell}>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {schedule.recentActions.map((action, i) => (
              <tr key={i}>
                <td style={cell}>{when(action.scheduledAt)}</td>
                <td style={cell}>{when(action.takenAt)}</td>
                <td style={cell}>
                  {action.workflowId && action.runId ? (
                    <a href={workflowLink({ cluster, namespace, workflowId: action.workflowId, runId: action.runId })}>
                      {action.workflowId}
                    </a>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h3 style={{ fontSize: 14 }}>Upcoming runs</h3>
      {schedule.nextActionTimes.length === 0 ? (
        <p>None scheduled.</p>
      ) : (
        <ul>
          {schedule.nextActionTimes.map(t => (
            <li key={t}>{when(t)}</li>
          ))}
        </ul>
      )}
    </>
  );
}

/** One workflow execution: metadata, diagram and inputs, event history, and the schedule that started it. */
export function WorkflowPage() {
  const api = useTemporalApi();
  const dark = useIsDark();
  const params = useUrlParams();
  const cluster = params.get('cluster') ?? '';
  const namespace = params.get('namespace') ?? '';
  const workflowId = params.get('workflowId') ?? '';
  const runId = params.get('runId') ?? '';
  const ready = Boolean(cluster && namespace && workflowId && runId);
  const path = `/workflows/${namespace}/${encodeURIComponent(workflowId)}/${runId}`;

  const detail = useLoad(
    () => (ready ? api.get<WorkflowExecutionDetail>(path, { cluster }) : undefined),
    [api, ready, path, cluster],
  );
  const history = useLoad(
    () => (ready ? api.get<WorkflowHistoryResponse>(`${path}/history`, { cluster }) : undefined),
    [api, ready, path, cluster],
  );
  const scheduledBy = detail.data?.scheduledBy;
  const schedule = useLoad(
    () =>
      scheduledBy
        ? api.get<ScheduleDetail>(`/schedules/${encodeURIComponent(scheduledBy)}`, { cluster, namespace })
        : undefined,
    [api, scheduledBy, cluster, namespace],
  );

  const events = useMemo(() => history.data?.events ?? [], [history.data]);
  const built = useMemo(() => buildHistoryGraph(events), [events]);
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set());
  const toggle = (id: number) =>
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const d = detail.data;

  let diagram: ReactNode;
  if (!history.data) {
    diagram = <p>{history.error ? `Could not load history: ${history.error}` : 'Loading history…'}</p>;
  } else if (built.graph.nodes.length === 0) {
    diagram = <p>No activities in this execution</p>;
  } else {
    diagram = (
      <div style={{ height: 360 }}>
        <WorkflowDiagram graph={built.graph} states={built.states} dark={dark} />
      </div>
    );
  }

  let scheduleBody: ReactNode;
  if (!scheduledBy) {
    scheduleBody = <p>Not started by a Temporal Schedule.</p>;
  } else if (schedule.error) {
    scheduleBody = <p role="alert">Could not load schedule: {schedule.error}</p>;
  } else if (!schedule.data) {
    scheduleBody = <p>Loading schedule…</p>;
  } else {
    scheduleBody = <ScheduleView schedule={schedule.data} cluster={cluster} namespace={namespace} />;
  }

  const crumbs = (
    <nav aria-label="Breadcrumb">
      <a href="/temporal">Temporal</a> › <a href={workflowsLink({ cluster, namespace })}>Workflows</a> › {workflowId}
    </nav>
  );

  return (
    <Page themeId="tool">
      <Header
        title={
          <>
            {workflowId || 'Workflow'} {d && <RunStatusBadge status={d.status} />}
          </>
        }
        subtitle={crumbs}
      />
      <Content>
        {!ready && <p role="alert">This page needs cluster, namespace, workflowId and runId in the link.</p>}
        {detail.error && <p role="alert">Could not load workflow: {detail.error}</p>}

        {d && (
          <div style={{ marginBottom: 16 }}>
            <Chips
              items={[
                ['Start Time', when(d.startTime)],
                ['End Time', when(d.closeTime)],
                ['Duration', formatDuration(d.durationSeconds)],
                ['Run ID', d.runId],
                ['Task Queue', d.taskQueue],
                ['Workflow Type', d.workflowType],
                ['Scheduled By', d.scheduledBy ? <a href="#schedule">{d.scheduledBy}</a> : '—'],
                ['History events', String(d.historyLength ?? (history.data ? events.length : '—'))],
              ]}
            />
            {d.uiUrl && (
              <p style={{ margin: '8px 0 0' }}>
                <a href={d.uiUrl} target="_blank" rel="noreferrer">
                  Open in Temporal UI
                </a>
              </p>
            )}
          </div>
        )}

        {d && (
          <section style={card}>
            <h2 style={{ fontSize: 18, marginTop: 0 }}>Execution</h2>
            <h3 style={{ fontSize: 14 }}>Workflow diagram</h3>
            {diagram}
            {d.failure && <p style={{ color: '#dc2626' }}>Failure: {d.failure}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginTop: 16 }}>
              <Payload label="Input" value={d.input} missing={NOT_AVAILABLE} />
              <Payload label="Result" value={d.result} missing={d.status === 'RUNNING' ? 'Still running' : NOT_AVAILABLE} />
            </div>
          </section>
        )}

        <section style={card}>
          <h2 style={{ fontSize: 18, marginTop: 0 }}>Event history</h2>
          {history.error && <p role="alert">Could not load history: {history.error}</p>}
          {!history.data && !history.error && <p>Loading history…</p>}
          {history.data?.truncated && (
            <p>History is truncated: only the first {events.length} events are shown.</p>
          )}
          {history.data && events.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" onClick={() => setOpen(new Set(events.map(e => e.eventId)))}>
                  Expand all
                </button>
                <button type="button" onClick={() => setOpen(new Set())}>
                  Collapse all
                </button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={cell}>Event ID</th>
                    <th style={cell}>Time</th>
                    <th style={cell}>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map(e => {
                    const expanded = open.has(e.eventId);
                    return (
                      <Fragment key={e.eventId}>
                        <tr>
                          <td style={cell}>{e.eventId}</td>
                          <td style={cell}>{when(e.eventTime)}</td>
                          <td style={cell}>
                            <button type="button" aria-expanded={expanded} onClick={() => toggle(e.eventId)} style={plainButton}>
                              {expanded ? '▾' : '▸'} {e.eventType}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr>
                            <td colSpan={3} style={cell}>
                              {Object.keys(e.attributes).length > 0 ? (
                                <JsonViewer value={e.attributes} />
                              ) : (
                                <p style={{ margin: 0, opacity: 0.7 }}>{NOT_AVAILABLE}</p>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        {d && (
          <section id="schedule" style={card}>
            <h2 style={{ fontSize: 18, marginTop: 0 }}>Schedule</h2>
            {scheduleBody}
          </section>
        )}
      </Content>
    </Page>
  );
}

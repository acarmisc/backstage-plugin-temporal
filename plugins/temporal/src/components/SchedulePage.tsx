/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Content, Header, Page } from '@backstage/core-components';
import type { ScheduleDetail } from '@acarmisc/backstage-plugin-temporal-common';
import { useTemporalApi } from '../api';
import { useLoad } from '../hooks';
import { cadenceText, relativeTime } from './format';
import { JsonViewer } from './JsonViewer';
import { card, StateBadge, Timeline } from './SchedulesPage';
import { schedulesLink, useUrlParams, workflowLink } from './links';

const cell = { padding: '6px 10px', borderBottom: '1px solid rgba(128,128,128,0.25)', textAlign: 'left' as const };
const when = (iso: string) => `${new Date(iso).toLocaleString()} (${relativeTime(iso)})`;

/** One schedule: cadence, policy, upcoming runs and the workflows it recently started. */
export function SchedulePage() {
  const api = useTemporalApi();
  const params = useUrlParams();
  const cluster = params.get('cluster') ?? '';
  const namespace = params.get('namespace') ?? '';
  const scheduleId = params.get('scheduleId') ?? '';
  const schedule = useLoad(
    () =>
      cluster && namespace && scheduleId
        ? api.get<ScheduleDetail>(`/schedules/${encodeURIComponent(scheduleId)}`, { cluster, namespace })
        : undefined,
    [api, cluster, namespace, scheduleId],
  );
  const s = schedule.data;
  const next = s?.nextActionTimes.slice(0, 5) ?? [];

  return (
    <Page themeId="tool">
      <Header title={scheduleId || 'Schedule'} subtitle={`${cluster} / ${namespace}`} />
      <Content>
        <p>
          <a href={schedulesLink({ cluster, namespace })}>← All schedules</a>
        </p>
        {schedule.error && <p role="alert">Could not load schedule: {schedule.error}</p>}
        {!s && !schedule.error && <p>Loading schedule…</p>}
        {s && (
          <div style={{ display: 'grid', gap: 16 }}>
            <section style={card}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <h2 style={{ fontSize: 20, margin: 0 }}>{cadenceText(s.spec)}</h2>
                <StateBadge paused={s.paused} />
              </div>
              {s.note && <p>{s.note}</p>}
              <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px' }}>
                <dt>Workflow type</dt>
                <dd>{s.workflowType ?? '—'}</dd>
                <dt>Overlap policy</dt>
                <dd>{s.overlapPolicy ?? '—'}</dd>
                <dt>Timezone</dt>
                <dd>{s.spec.timezone ?? 'UTC'}</dd>
              </dl>
              {s.spec.calendars && s.spec.calendars.length > 0 && <JsonViewer value={s.spec.calendars} />}
            </section>
            <section style={card}>
              <h3 style={{ marginTop: 0 }}>Next runs</h3>
              {next.length === 0 ? (
                <p>None scheduled.</p>
              ) : (
                <>
                  <Timeline times={next} />
                  <ul>
                    {next.map(t => (
                      <li key={t}>{when(t)}</li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section style={card}>
              <h3 style={{ marginTop: 0 }}>Recent actions</h3>
              {s.recentActions.length === 0 ? (
                <p>No actions yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={cell}>Taken at</th>
                      <th style={cell}>Workflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...s.recentActions].reverse().map(a => (
                      <tr key={`${a.takenAt}${a.workflowId}`}>
                        <td style={cell}>{when(a.takenAt)}</td>
                        <td style={cell}>
                          {a.workflowId && a.runId ? (
                            <a href={workflowLink({ cluster, namespace, workflowId: a.workflowId, runId: a.runId })}>
                              {a.workflowId}
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
            </section>
          </div>
        )}
      </Content>
    </Page>
  );
}

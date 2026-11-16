/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { Fragment, useMemo, type ReactNode } from 'react';
import { Content, Header, InfoCard, Link, Page, Table, type TableColumn } from '@backstage/core-components';
import { Accordion, AccordionDetails, AccordionSummary, Card, CardContent, Grid, Typography } from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import type {
  ScheduleDetail,
  TemporalHistoryEvent,
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
import { scheduleLink, useUrlParams, workflowLink, workflowsLink } from './links';
import { WorkflowDiagram } from './WorkflowDiagram';

type ScheduleAction = ScheduleDetail['recentActions'][number];
const NOT_AVAILABLE = 'Not available (requires temporal.run.read)';
const tableOptions = { paging: false, search: false, padding: 'dense' as const };

const when = (value?: string) => (value ? new Date(value).toLocaleString() : '—');

function Kpis({ items }: { items: [string, ReactNode][] }) {
  return (
    <Grid container spacing={2}>
      {items.map(([label, value]) => (
        <Grid item key={label} xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="overline" color="textSecondary">
                {label}
              </Typography>
              <Typography variant="body1" component="div" style={{ wordBreak: 'break-all' }}>
                {value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

/** A collapsed block holding one payload (input, result, calendar specs). */
function Payload({ label, value, missing }: { label: string; value: unknown; missing: string }) {
  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">{label}</Typography>
      </AccordionSummary>
      <AccordionDetails style={{ display: 'block', minWidth: 0 }}>
        {value === undefined ? <Typography color="textSecondary">{missing}</Typography> : <JsonViewer value={value} />}
      </AccordionDetails>
    </Accordion>
  );
}

function ScheduleCards({ schedule, cluster, namespace }: { schedule: ScheduleDetail; cluster: string; namespace: string }) {
  const { spec } = schedule;
  const actions: TableColumn<ScheduleAction>[] = [
    { title: 'Taken at', render: a => when(a.takenAt) },
    {
      title: 'Workflow',
      render: a =>
        a.workflowId && a.runId ? (
          <Link to={workflowLink({ cluster, namespace, workflowId: a.workflowId, runId: a.runId })}>{a.workflowId}</Link>
        ) : (
          '—'
        ),
    },
  ];
  const meta: [string, ReactNode][] = [
    ['Schedule ID', <Link to={scheduleLink({ cluster, namespace, scheduleId: schedule.scheduleId })}>{schedule.scheduleId}</Link>],
    ['State', schedule.paused ? 'Paused' : 'Active'],
    ['Note', schedule.note ?? '—'],
    ['Cron', spec.cronExpressions?.join(', ') || '—'],
    ['Intervals', spec.intervals?.map(i => `every ${i.every}${i.offset ? ` offset ${i.offset}` : ''}`).join(', ') || '—'],
    ['Timezone', spec.timezone ?? '—'],
    ['Overlap policy', schedule.overlapPolicy ?? '—'],
    ['Workflow type', schedule.workflowType ?? '—'],
  ];
  return (
    <>
      <Grid item xs={12} md={4}>
        <InfoCard title="Schedule">
          <dl style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 16px', margin: 0 }}>
            {meta.map(([k, v]) => (
              <Fragment key={k}>
                <dt style={{ opacity: 0.7 }}>{k}</dt>
                <dd style={{ margin: 0, wordBreak: 'break-all' }}>{v}</dd>
              </Fragment>
            ))}
          </dl>
          {spec.calendars && spec.calendars.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <Payload label="Calendar specs" value={spec.calendars} missing={NOT_AVAILABLE} />
            </div>
          )}
        </InfoCard>
      </Grid>
      <Grid item xs={12} md={4}>
        <Table<ScheduleAction>
          title="Recent actions"
          options={tableOptions}
          columns={actions}
          data={schedule.recentActions}
          emptyContent={<Typography style={{ padding: 16 }}>No actions yet.</Typography>}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <Table<{ t: string }>
          title="Upcoming runs"
          options={tableOptions}
          columns={[{ title: 'Time', render: r => when(r.t) }]}
          data={schedule.nextActionTimes.map(t => ({ t }))}
          emptyContent={<Typography style={{ padding: 16 }}>None scheduled.</Typography>}
        />
      </Grid>
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

  const eventColumns: TableColumn<TemporalHistoryEvent>[] = [
    { title: 'Event ID', field: 'eventId', width: '120px' },
    { title: 'Time', render: e => when(e.eventTime) },
    { title: 'Type', field: 'eventType' },
  ];

  let scheduleSection: ReactNode;
  if (!scheduledBy) {
    scheduleSection = (
      <Grid item xs={12}>
        <InfoCard title="Schedule">Not started by a Temporal Schedule.</InfoCard>
      </Grid>
    );
  } else if (schedule.error) {
    scheduleSection = (
      <Grid item xs={12}>
        <InfoCard title="Schedule">
          <p role="alert">Could not load schedule: {schedule.error}</p>
        </InfoCard>
      </Grid>
    );
  } else if (!schedule.data) {
    scheduleSection = (
      <Grid item xs={12}>
        <InfoCard title="Schedule">Loading schedule…</InfoCard>
      </Grid>
    );
  } else {
    scheduleSection = <ScheduleCards schedule={schedule.data} cluster={cluster} namespace={namespace} />;
  }

  const crumbs = (
    <nav aria-label="Breadcrumb">
      <Link to="/temporal" color="inherit">
        Temporal
      </Link>{' '}
      ›{' '}
      <Link to={workflowsLink({ cluster, namespace })} color="inherit">
        Workflows
      </Link>{' '}
      › {workflowId}
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
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Kpis
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
                  <Link to={d.uiUrl}>Open in Temporal UI</Link>
                </p>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              <InfoCard title="Workflow diagram">
                {diagram}
                {d.failure && <p style={{ color: '#dc2626' }}>Failure: {d.failure}</p>}
              </InfoCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <Payload label="Input" value={d.input} missing={NOT_AVAILABLE} />
              <Payload label="Output" value={d.result} missing={d.status === 'RUNNING' ? 'Still running' : NOT_AVAILABLE} />
            </Grid>

            <Grid item xs={12}>
              {history.error && <p role="alert">Could not load history: {history.error}</p>}
              {history.data?.truncated && <p>History is truncated: only the first {events.length} events are shown.</p>}
              <Table<TemporalHistoryEvent>
                title="Event history"
                isLoading={!history.data && !history.error}
                options={{ search: false, padding: 'dense', pageSize: 25, pageSizeOptions: [25, 50, 100] }}
                columns={eventColumns}
                data={events}
                detailPanel={({ rowData }) => (
                  <div style={{ padding: 16 }}>
                    {Object.keys(rowData.attributes).length > 0 ? (
                      <JsonViewer value={rowData.attributes} />
                    ) : (
                      <Typography color="textSecondary">{NOT_AVAILABLE}</Typography>
                    )}
                  </div>
                )}
              />
            </Grid>

            <Grid item xs={12} id="schedule">
              <Grid container spacing={3}>
                {scheduleSection}
              </Grid>
            </Grid>
          </Grid>
        )}
      </Content>
    </Page>
  );
}

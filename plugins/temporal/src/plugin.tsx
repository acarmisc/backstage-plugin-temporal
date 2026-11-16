/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { createFrontendPlugin, createRouteRef, PageBlueprint } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint, EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { TEMPORAL_PLUGIN_ID } from '@acarmisc/backstage-plugin-temporal-common';
import { hasTemporalStream } from './components/entity';

const rootRouteRef = createRouteRef();

const streamsPage = PageBlueprint.make({
  params: {
    path: '/temporal',
    routeRef: rootRouteRef,
    title: 'Temporal',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8Zm1-13h-2v6l5 3 1-1.7-4-2.3Z" />
      </svg>
    ),
    loader: () => import('./components/StreamsPage').then(m => <m.StreamsPage />),
  },
});

const streamPage = PageBlueprint.make({
  name: 'stream',
  params: {
    path: '/temporal/stream',
    loader: () => import('./components/StreamPage').then(m => <m.StreamPage />),
  },
});

const definitionPage = PageBlueprint.make({
  name: 'definition',
  params: {
    path: '/temporal/definition',
    loader: () => import('./components/DefinitionPage').then(m => <m.DefinitionPage />),
  },
});

const workflowsPage = PageBlueprint.make({
  name: 'workflows',
  params: {
    path: '/temporal/workflows',
    loader: () => import('./components/WorkflowsPage').then(m => <m.WorkflowsPage />),
  },
});

const workflowPage = PageBlueprint.make({
  name: 'workflow',
  params: {
    path: '/temporal/workflow',
    loader: () => import('./components/WorkflowPage').then(m => <m.WorkflowPage />),
  },
});

const schedulesPage = PageBlueprint.make({
  name: 'schedules',
  params: {
    path: '/temporal/schedules',
    loader: () => import('./components/SchedulesPage').then(m => <m.SchedulesPage />),
  },
});

const schedulePage = PageBlueprint.make({
  name: 'schedule',
  params: {
    path: '/temporal/schedule',
    loader: () => import('./components/SchedulePage').then(m => <m.SchedulePage />),
  },
});

const entityTab = EntityContentBlueprint.make({
  name: 'stream-tab',
  params: {
    path: 'temporal',
    title: 'Temporal',
    filter: hasTemporalStream,
    loader: () => import('./components/TemporalTab').then(m => <m.TemporalTab />),
  },
});

const entityCard = EntityCardBlueprint.make({
  name: 'stream-card',
  params: {
    filter: hasTemporalStream,
    loader: () => import('./components/TemporalCard').then(m => <m.TemporalCard />),
  },
});

export const temporalPlugin = createFrontendPlugin({
  pluginId: TEMPORAL_PLUGIN_ID,
  routes: { root: rootRouteRef },
  extensions: [streamsPage, streamPage, definitionPage, workflowsPage, workflowPage, schedulesPage, schedulePage, entityTab, entityCard],
});

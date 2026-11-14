/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { createFrontendPlugin, PageBlueprint } from '@backstage/frontend-plugin-api';
import { EntityCardBlueprint, EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { TEMPORAL_PLUGIN_ID } from '@acarmisc/backstage-plugin-temporal-common';
import { hasTemporalStream } from './components/entity';

const streamsPage = PageBlueprint.make({
  name: 'streams',
  params: {
    path: '/temporal',
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
  extensions: [streamsPage, streamPage, definitionPage, entityTab, entityCard],
});

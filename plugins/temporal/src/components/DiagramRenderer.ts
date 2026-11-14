/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ComponentType } from 'react';
import type { StageState, WorkflowGraph } from '@acarmisc/backstage-plugin-temporal-common';

export interface DiagramRendererProps {
  graph: WorkflowGraph;
  /** Live state per stage id (M4). Without it the diagram is a static definition. */
  states?: Record<string, StageState>;
  dark?: boolean;
}

/**
 * The contract every diagram implementation follows. The default is React Flow;
 * the plugin does not depend on it beyond that component, so it can be replaced.
 */
export type DiagramRenderer = ComponentType<DiagramRendererProps>;

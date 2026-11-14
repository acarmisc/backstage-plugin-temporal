/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import { parseWorkflowYaml, type StageState } from '@acarmisc/backstage-plugin-temporal-common';
import { WorkflowDiagram } from './WorkflowDiagram';

// React Flow measures its container; jsdom has no ResizeObserver.
beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const graph = parseWorkflowYaml(`
name: demo
stages:
  - {name: fetch, role: source, use: cli, run: [fetch-jira]}
  - {name: docs, role: source, use: k8s_job, cronjob: docs, namespace: ns, optional: true}
  - {name: review, use: cli, needs: [fetch, docs], run: [review]}
  - {name: publish, use: kb_sync, approval: true, needs: [review], params: {kb_id: K1, prefix: p}}
`);

describe('WorkflowDiagram', () => {
  it('draws every stage of the definition', () => {
    render(<WorkflowDiagram graph={graph} />);
    for (const id of ['fetch', 'docs', 'review', 'publish']) {
      expect(screen.getByTestId(`stage-${id}`)).toBeInTheDocument();
    }
  });

  it('shows the state of each stage when given states', () => {
    const states: Record<string, StageState> = {
      fetch: 'ok',
      docs: 'failed',
      review: 'running',
      publish: 'waiting-approval',
    };
    render(<WorkflowDiagram graph={graph} states={states} dark />);
    expect(screen.getByTestId('stage-review')).toHaveAttribute('data-state', 'running');
    expect(screen.getByTestId('stage-docs')).toHaveAttribute('data-state', 'failed');
  });

  it('renders without states as a static definition', () => {
    render(<WorkflowDiagram graph={graph} />);
    expect(screen.getByTestId('stage-fetch')).toHaveAttribute('data-state', 'static');
  });
});

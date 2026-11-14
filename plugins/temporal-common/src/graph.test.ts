/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import {
  WorkflowDefinitionError,
  parseWorkflowDefinition,
  parseWorkflowYaml,
} from './index';

const stage = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  use: 'cli',
  run: ['true'],
  ...extra,
});

describe('dependency graph (kbflow needs / role / optional / approval)', () => {
  it('draws parallel branches from explicit needs', () => {
    const graph = parseWorkflowDefinition({
      name: 'fan-out',
      stages: [
        stage('clone'),
        stage('a', { needs: ['clone'] }),
        stage('b', { needs: ['clone'] }),
        stage('join', { needs: ['a', 'b'] }),
      ],
    });
    expect(graph.edges).toEqual([
      { from: 'clone', to: 'a' },
      { from: 'clone', to: 'b' },
      { from: 'a', to: 'join' },
      { from: 'b', to: 'join' },
    ]);
  });

  it('treats an empty needs list as no dependency at all', () => {
    const graph = parseWorkflowDefinition({
      name: 'roots',
      stages: [stage('a'), stage('b', { needs: [] })],
    });
    expect(graph.edges).toEqual([]);
  });

  it('carries role, optional and approval onto the nodes', () => {
    const graph = parseWorkflowDefinition({
      name: 'flags',
      stages: [
        stage('src', { role: 'source', optional: true }),
        stage('pub', { use: 'kb_sync', approval: true, params: { kb_id: 'K1', prefix: 'p' } }),
      ],
    });
    expect(graph.nodes[0]).toMatchObject({ group: 'source', optional: true });
    expect(graph.nodes[1]).toMatchObject({ gate: true, kind: 'kb_sync' });
    expect(graph.meta?.queues).toEqual(['kb-K1']);
  });

  it('keeps an explicit queue override', () => {
    const graph = parseWorkflowDefinition({
      name: 'queued',
      stages: [stage('a', { queue: 'gpu' })],
    });
    expect(graph.meta?.queues).toEqual(['gpu']);
  });

  it('accepts the stages of a serialised run input, where needs is always set', () => {
    const graph = parseWorkflowDefinition({
      name: 'run-input',
      cron: '',
      timezone: 'Europe/Rome',
      paused: false,
      stages: [
        { name: 'a', use: 'cli', run: ['x'], needs: [] },
        { name: 'b', use: 'cli', run: ['y'], needs: ['a'] },
      ],
    });
    expect(graph.edges).toEqual([{ from: 'a', to: 'b' }]);
    expect(graph.meta?.schedule).toBeUndefined();
  });
});

describe('validation', () => {
  const expectError = (raw: unknown, pattern: RegExp) => {
    expect(() => parseWorkflowDefinition(raw)).toThrow(WorkflowDefinitionError);
    expect(() => parseWorkflowDefinition(raw)).toThrow(pattern);
  };

  it('rejects a cycle and names the stages involved', () => {
    expectError(
      {
        name: 'loop',
        stages: [stage('a', { needs: ['b'] }), stage('b', { needs: ['a'] })],
      },
      /dependency cycle among stages a, b/,
    );
  });

  it('rejects a dependency on an unknown stage', () => {
    expectError(
      { name: 'x', stages: [stage('a', { needs: ['ghost'] })] },
      /unknown dependency "ghost"/,
    );
  });

  it('rejects a stage that depends on itself', () => {
    expectError(
      { name: 'x', stages: [stage('a', { needs: ['a'] })] },
      /unknown dependency "a"/,
    );
  });

  it('rejects duplicate stage names', () => {
    expectError(
      { name: 'x', stages: [stage('a'), stage('a')] },
      /duplicate stage name "a"/,
    );
  });

  it('rejects a stream with no stages', () => {
    expectError({ name: 'empty', stages: [] }, /no stages defined/);
  });

  it('rejects an unknown stage kind', () => {
    expectError(
      { name: 'x', stages: [stage('a', { use: 'lambda' })] },
      /use must be one of cli, k8s_job/,
    );
  });

  it('rejects a document without a name', () => {
    expectError({ stages: [stage('a')] }, /stream name: expected a non-empty string/);
  });
});

describe('steps format', () => {
  it('draws approval steps as gates and keeps the sequence', () => {
    const graph = parseWorkflowYaml(
      [
        'name: release',
        'steps:',
        '  - {name: build, type: task}',
        '  - {name: approve, type: approval}',
        '  - {name: deploy, type: task}',
      ].join('\n'),
    );
    expect(graph.meta?.source).toBe('steps');
    expect(graph.nodes.map(n => [n.id, n.kind, n.gate ?? false])).toEqual([
      ['build', 'task', false],
      ['approve', 'approval', true],
      ['deploy', 'task', false],
    ]);
    expect(graph.edges).toEqual([
      { from: 'build', to: 'approve' },
      { from: 'approve', to: 'deploy' },
    ]);
  });
});

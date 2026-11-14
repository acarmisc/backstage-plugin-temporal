/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  WorkflowDefinitionError,
  parseWorkflowDefinition,
  parseWorkflowYaml,
} from './index';

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__/kbflow', `${name}.yaml`), 'utf8');

describe('kbflow fixtures', () => {
  it('draws jira-kb as a linear chain of eight stages', () => {
    const graph = parseWorkflowYaml(fixture('jira-kb'));

    expect(graph.nodes.map(n => n.id)).toEqual([
      'clone-kb',
      'preflight',
      'capture',
      'render',
      'validate',
      'export',
      'push-kb',
      'publish-kb',
    ]);
    expect(graph.edges).toHaveLength(7);
    expect(graph.edges[0]).toEqual({ from: 'clone-kb', to: 'preflight' });
    expect(graph.edges[6]).toEqual({ from: 'push-kb', to: 'publish-kb' });
    expect(graph.meta).toEqual({
      source: 'kbflow',
      schedule: undefined,
      queues: ['kb-KBEXAMPLE01'],
    });
  });

  it('summarises each stage kind in the node detail', () => {
    const graph = parseWorkflowYaml(fixture('jira-kb'));
    const byId = Object.fromEntries(graph.nodes.map(n => [n.id, n]));

    expect(byId['clone-kb']).toMatchObject({ kind: 'git', detail: 'clone develop' });
    expect(byId.preflight).toMatchObject({
      kind: 'cli',
      detail: 'jira-kb preflight --config config/pilot.yaml',
    });
    expect(byId['publish-kb']).toMatchObject({
      kind: 'kb_sync',
      detail: 'example-jira-kb',
    });
  });

  it('draws the knowledge-base stream with its validation stages', () => {
    const graph = parseWorkflowYaml(fixture('wiki-kb'));
    expect(graph.nodes.map(n => [n.id, n.kind])).toEqual([
      ['clone-kb', 'git'],
      ['validate', 'cli'],
      ['graph-check', 'cli'],
      ['publish-kb', 'kb_sync'],
    ]);
    expect(graph.meta?.queues).toEqual(['kb-KBEXAMPLE02']);
  });

  it('draws the evidence stream, whose last stage opens a merge request', () => {
    const graph = parseWorkflowYaml(fixture('wiki-evidence'));
    expect(graph.nodes.map(n => n.id)).toEqual([
      'clone-kb',
      'evidence',
      'graph',
      'open-mr',
    ]);
    expect(graph.nodes[3]).toMatchObject({ kind: 'git', detail: 'push main' });
    expect(graph.meta?.queues).toBeUndefined();
  });

  it('draws k8s job stages with their namespace and cronjob', () => {
    const graph = parseWorkflowYaml(fixture('product-kb'));
    expect(graph.nodes).toHaveLength(5);
    expect(graph.nodes[0]).toMatchObject({
      kind: 'k8s_job',
      detail: 'example-ns/example-jira-fetcher',
    });
    expect(graph.nodes.at(-1)?.id).toBe('publish-kb');
  });
});

describe('parseWorkflowYaml', () => {
  it('reports invalid YAML with a clear error', () => {
    expect(() => parseWorkflowYaml('name: [unclosed')).toThrow(
      WorkflowDefinitionError,
    );
    expect(() => parseWorkflowYaml('name: [unclosed')).toThrow(/invalid YAML/);
  });

  it('rejects a document that matches no known format', () => {
    expect(() => parseWorkflowYaml('name: x\nthings: []')).toThrow(
      /unrecognised workflow definition format/,
    );
  });

  it('uses the explicit format when given', () => {
    expect(() =>
      parseWorkflowYaml(fixture('jira-kb'), { format: 'steps' }),
    ).toThrow(/workflow name|steps/);
    expect(() => parseWorkflowYaml(fixture('jira-kb'), { format: 'nope' })).toThrow(
      /unknown definition format/,
    );
  });
});

describe('parseWorkflowDefinition', () => {
  it('reads the schedule from a top-level cron (serialised run input)', () => {
    const graph = parseWorkflowDefinition({
      name: 'nightly',
      cron: '0 3 * * *',
      timezone: 'Europe/Rome',
      paused: true,
      stages: [{ name: 'a', use: 'cli', run: ['true'] }],
    });
    expect(graph.meta?.schedule).toEqual({
      cron: '0 3 * * *',
      timezone: 'Europe/Rome',
      paused: true,
    });
  });

  it('reads the schedule from a schedule block (YAML file)', () => {
    const graph = parseWorkflowDefinition({
      name: 'nightly',
      schedule: { cron: '0 6 * * 1' },
      stages: [{ name: 'a', use: 'cli', run: ['true'] }],
    });
    expect(graph.meta?.schedule).toEqual({
      cron: '0 6 * * 1',
      timezone: 'Europe/Rome',
      paused: false,
    });
  });
});

describe("kbflow DAG (two parallel sources)", () => {
  it("draws the sources in parallel and joins them at qualify", () => {
    const graph = parseWorkflowYaml(fixture("multisource-dag"));
    expect(graph.edges).toEqual([
      { from: "jira", to: "qualifica" },
      { from: "confluence", to: "qualifica" },
      { from: "qualifica", to: "sintesi" },
      { from: "sintesi", to: "push" },
      { from: "push", to: "pubblica" },
    ]);
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    expect(byId.confluence).toMatchObject({ group: "source", optional: true, kind: "k8s_job" });
    expect(byId.jira.optional).toBeFalsy();
    expect(byId.qualifica.kind).toBe("qualify");
  });
});

/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { graphToMermaid } from './mermaid';
import { layoutGraph } from './layout';
import { graphToSvg } from './svg';
import { parseWorkflowYaml } from './parse';
import { buildGraph } from './graph';

const load = (name: string) =>
  parseWorkflowYaml(
    readFileSync(join(__dirname, '__fixtures__/kbflow', `${name}.yaml`), 'utf8'),
  );

describe('layoutGraph', () => {
  it('places each stage below its dependencies (top to bottom)', () => {
    const layout = layoutGraph(load('jira-kb'));
    const y = Object.fromEntries(layout.nodes.map(n => [n.id, n.y]));
    expect(y['clone-kb']).toBeLessThan(y.preflight);
    expect(y.preflight).toBeLessThan(y['publish-kb']);
  });

  it('puts independent sources on the same rank', () => {
    const layout = layoutGraph(load('multisource-dag'));
    const y = Object.fromEntries(layout.nodes.map(n => [n.id, n.y]));
    expect(y.jira).toBe(y.confluence);
    expect(y.jira).toBeLessThan(y.qualifica);
    expect(layout.edges).toHaveLength(5);
    expect(layout.edges.every(e => e.points.length >= 2)).toBe(true);
  });
});

describe('graphToSvg', () => {
  it('draws one box per stage and is well-formed', () => {
    const graph = load('wiki-kb');
    const svg = graphToSvg(graph);
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<text /g) ?? []).length).toBe(graph.nodes.length * 2);
    expect(svg).toContain('clone-kb');
  });

  it('dashes optional stages and escapes labels', () => {
    const graph = buildGraph({ name: 'x<y' }, [
      { id: 'a&b', kind: 'cli', optional: true, detail: '<script>' },
    ]);
    const svg = graphToSvg(graph);
    expect(svg).toContain('stroke-dasharray');
    expect(svg).toContain('a&amp;b');
    expect(svg).not.toContain('<script>');
  });
});

describe('graphToMermaid', () => {
  it('writes a flowchart with one edge per dependency', () => {
    const mermaid = graphToMermaid(load('multisource-dag'));
    expect(mermaid.startsWith('flowchart TD')).toBe(true);
    expect(mermaid).toContain('jira --> qualifica');
    expect(mermaid).toContain('confluence --> qualifica');
    expect(mermaid).toContain('qualifica["qualifica');
  });

  it('keeps identifiers valid and unique', () => {
    const graph = buildGraph({ name: 'ids' }, [
      { id: 'a-b', kind: 'cli' },
      { id: 'a_b', kind: 'cli', needs: ['a-b'] },
    ]);
    const mermaid = graphToMermaid(graph);
    expect(mermaid).toContain('a_b["a-b');
    expect(mermaid).toContain('a_b_["a_b');
    expect(mermaid).toContain('a_b --> a_b_');
  });
});

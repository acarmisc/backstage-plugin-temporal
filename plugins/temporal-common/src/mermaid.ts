/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import type { WorkflowGraph } from './graph';

/** Mermaid identifiers cannot contain dashes or dots: map them to underscores, keep unique. */
function mermaidIds(graph: WorkflowGraph): Map<string, string> {
  const ids = new Map<string, string>();
  const used = new Set<string>();
  for (const node of graph.nodes) {
    let id = node.id.replace(/[^A-Za-z0-9_]/g, '_') || 'node';
    while (used.has(id)) {
      id = `${id}_`;
    }
    used.add(id);
    ids.set(node.id, id);
  }
  return ids;
}

const escapeLabel = (text: string) => text.replace(/"/g, '#quot;');

/** Mermaid flowchart, top to bottom, for documentation (TechDocs, pull requests). */
export function graphToMermaid(graph: WorkflowGraph): string {
  const ids = mermaidIds(graph);
  const lines = ['flowchart TD'];
  for (const node of graph.nodes) {
    const kind = node.kind;
    const label = escapeLabel(`${node.label}<br/><small>${kind}</small>`);
    const id = ids.get(node.id)!;
    // Gates are hexagons, optional stages have a dotted look via a label suffix.
    const text = node.optional ? `${label}<br/><small>(optional)</small>` : label;
    lines.push(node.gate ? `  ${id}{{"${text}"}}` : `  ${id}["${text}"]`);
  }
  for (const edge of graph.edges) {
    lines.push(`  ${ids.get(edge.from)} --> ${ids.get(edge.to)}`);
  }
  return `${lines.join('\n')}\n`;
}

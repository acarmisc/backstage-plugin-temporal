/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

export interface WorkflowSchedule {
  cron: string;
  timezone?: string;
  paused?: boolean;
}

/** A stage or step of a workflow, as drawn in a diagram. */
export interface WorkflowNode {
  id: string;
  label: string;
  /** Format-specific type, e.g. `cli`, `git`, `k8s_job`. */
  kind: string;
  detail?: string;
  params?: Record<string, unknown>;
  /** The stage waits for a human approval before it runs. */
  gate?: boolean;
  /** Phase or role used to group stages (kbflow `role`). */
  group?: string;
  /** A failure is recorded but does not stop dependent stages. */
  optional?: boolean;
}

/** `from` must finish before `to` starts. */
export interface WorkflowEdge {
  from: string;
  to: string;
  label?: string;
}

export interface WorkflowGraph {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  meta?: {
    source?: string;
    schedule?: WorkflowSchedule;
    queues?: string[];
  };
}

export class WorkflowDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowDefinitionError';
  }
}

/** Input of {@link buildGraph}: one stage in declaration order. */
export interface StageSpec {
  id: string;
  label?: string;
  kind: string;
  detail?: string;
  params?: Record<string, unknown>;
  gate?: boolean;
  group?: string;
  optional?: boolean;
  /** Explicit dependencies. Omitted means "after the previous stage" (sequential). */
  needs?: string[];
}

/**
 * Builds a graph from stages in declaration order and validates it:
 * unique names, known dependencies, no cycles.
 */
export function buildGraph(
  base: { name: string; meta?: WorkflowGraph['meta'] },
  stages: StageSpec[],
): WorkflowGraph {
  if (stages.length === 0) {
    throw new WorkflowDefinitionError(`${base.name}: no stages defined`);
  }

  const ids = new Set<string>();
  for (const stage of stages) {
    if (!stage.id) {
      throw new WorkflowDefinitionError(`${base.name}: a stage has no name`);
    }
    if (ids.has(stage.id)) {
      throw new WorkflowDefinitionError(
        `${base.name}: duplicate stage name "${stage.id}"`,
      );
    }
    ids.add(stage.id);
  }

  const needs = new Map<string, string[]>();
  stages.forEach((stage, index) => {
    needs.set(
      stage.id,
      stage.needs ?? (index > 0 ? [stages[index - 1].id] : []),
    );
  });

  for (const [id, deps] of needs) {
    for (const dep of deps) {
      if (!ids.has(dep) || dep === id) {
        throw new WorkflowDefinitionError(
          `stage "${id}": unknown dependency "${dep}"`,
        );
      }
    }
  }
  assertAcyclic(base.name, needs);

  const edges: WorkflowEdge[] = [];
  for (const [to, deps] of needs) {
    for (const from of deps) {
      edges.push({ from, to });
    }
  }

  return {
    id: base.name,
    name: base.name,
    nodes: stages.map(stage => ({
      id: stage.id,
      label: stage.label ?? stage.id,
      kind: stage.kind,
      detail: stage.detail,
      params: stage.params,
      gate: stage.gate,
      group: stage.group,
      optional: stage.optional,
    })),
    edges,
    meta: base.meta,
  };
}

// Kahn's algorithm: repeatedly remove stages whose dependencies are all gone.
function assertAcyclic(name: string, needs: Map<string, string[]>) {
  const pending = new Map(
    [...needs].map(([id, deps]) => [id, new Set(deps)]),
  );
  while (pending.size > 0) {
    const ready = [...pending].filter(([, deps]) => deps.size === 0);
    if (ready.length === 0) {
      throw new WorkflowDefinitionError(
        `${name}: dependency cycle among stages ${[...pending.keys()]
          .sort()
          .join(', ')}`,
      );
    }
    for (const [id] of ready) {
      pending.delete(id);
    }
    for (const deps of pending.values()) {
      for (const [id] of ready) {
        deps.delete(id);
      }
    }
  }
}

/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { buildGraph, StageSpec } from '../graph';
import type { DefinitionParser } from '../parse';
import { asArray, asObject, Json, optionalStrings, requireString } from '../util';

/**
 * Generic minimal format for other companies:
 *
 *   name: my-flow
 *   steps:
 *     - {name: build, type: task}
 *     - {name: approve, type: approval}
 *     - {name: deploy, type: task, needs: [approve]}
 *
 * Steps run in order unless `needs` says otherwise. `type: approval` (or
 * `gate: true`) marks a step that waits for a human.
 */
export const stepsParser: DefinitionParser = {
  format: 'steps',

  canParse(raw) {
    return (
      typeof raw === 'object' &&
      raw !== null &&
      Array.isArray((raw as Json).steps)
    );
  },

  parse(raw) {
    const doc = asObject(raw, 'workflow definition');
    const name = requireString(doc.name, 'workflow name');
    const steps = asArray(doc.steps, `${name}: steps`).map((item, index): StageSpec => {
      const step = asObject(item, `${name}: step ${index + 1}`);
      const id = requireString(step.name, `${name}: step ${index + 1} name`);
      const type = typeof step.type === 'string' && step.type ? step.type : 'step';
      return {
        id,
        kind: type,
        detail: typeof step.detail === 'string' ? step.detail : undefined,
        gate: type === 'approval' || step.gate === true,
        needs: optionalStrings(step.needs, `step "${id}" needs`),
      };
    });

    return buildGraph({ name, meta: { source: 'steps' } }, steps);
  },
};

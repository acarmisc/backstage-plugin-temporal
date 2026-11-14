/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  buildGraph,
  StageSpec,
  WorkflowDefinitionError,
  WorkflowSchedule,
} from '../graph';
import type { DefinitionParser } from '../parse';
import { asArray, asObject, Json, optionalStrings, requireString } from '../util';

// Stage kinds (`use`) of the kbflow stream format. Must match kbflow's KINDS.
const KINDS = ['cli', 'k8s_job', 'git', 'kb_sync', 'qualify', 'synthesize'];
const DEFAULT_TIMEZONE = 'Europe/Rome';

// Queue override, or the per-KB default that serialises kb_sync stages.
function queueOf(stage: Json, use: string, params: Json): string {
  if (typeof stage.queue === 'string' && stage.queue) {
    return stage.queue;
  }
  return use === 'kb_sync' && params.kb_id ? `kb-${String(params.kb_id)}` : '';
}

function objectOrEmpty(value: unknown): Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function detailOf(use: string, stage: Json, params: Json): string | undefined {
  switch (use) {
    case 'cli':
      return optionalStrings(stage.run, 'run')?.join(' ').slice(0, 80);
    case 'k8s_job':
      return stage.namespace && stage.cronjob
        ? `${stage.namespace}/${stage.cronjob}`
        : undefined;
    case 'git':
      return typeof params.op === 'string'
        ? [params.op, params.branch].filter(Boolean).join(' ')
        : undefined;
    case 'kb_sync':
      return typeof params.prefix === 'string' ? params.prefix : undefined;
    default:
      return undefined;
  }
}

// Schedule: `schedule: {cron, timezone, paused}` in the YAML file, or top-level
// `cron`/`timezone`/`paused` in the serialised run input. Both are accepted.
function scheduleOf(doc: Json): WorkflowSchedule | undefined {
  const block = objectOrEmpty(doc.schedule);
  const cron = typeof block.cron === 'string' ? block.cron : doc.cron;
  if (typeof cron !== 'string' || cron === '') {
    return undefined;
  }
  const timezone = block.timezone ?? doc.timezone;
  return {
    cron,
    timezone: typeof timezone === 'string' ? timezone : DEFAULT_TIMEZONE,
    paused: block.paused === true || doc.paused === true,
  };
}

export const kbflowParser: DefinitionParser = {
  format: 'kbflow',

  canParse(raw) {
    return (
      typeof raw === 'object' &&
      raw !== null &&
      Array.isArray((raw as Json).stages)
    );
  },

  parse(raw) {
    const doc = asObject(raw, 'stream definition');
    const name = requireString(doc.name, 'stream name');
    const list = asArray(doc.stages, `${name}: stages`);

    const queues = new Set<string>();
    const stages = list.map((item, index): StageSpec => {
      const stage = asObject(item, `${name}: stage ${index + 1}`);
      const id = requireString(stage.name, `${name}: stage ${index + 1} name`);
      const use = requireString(stage.use, `stage "${id}" use`);
      if (!KINDS.includes(use)) {
        throw new WorkflowDefinitionError(
          `stage "${id}": use must be one of ${KINDS.join(', ')}`,
        );
      }

      const params = objectOrEmpty(stage.params);
      // Queue override, or the per-KB default that serialises kb_sync stages.
      const queue = queueOf(stage, use, params);
      if (queue) {
        queues.add(queue);
      }

      return {
        id,
        kind: use,
        detail: detailOf(use, stage, params),
        params,
        gate: stage.approval === true,
        group: typeof stage.role === 'string' && stage.role ? stage.role : undefined,
        optional: stage.optional === true,
        needs: optionalStrings(stage.needs, `stage "${id}" needs`),
      };
    });

    return buildGraph(
      {
        name,
        meta: {
          source: 'kbflow',
          schedule: scheduleOf(doc),
          queues: queues.size > 0 ? [...queues] : undefined,
        },
      },
      stages,
    );
  },
};

/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import { WorkflowDefinitionError } from './graph';

export type Json = Record<string, unknown>;

export function asObject(value: unknown, where: string): Json {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WorkflowDefinitionError(`${where}: expected an object`);
  }
  return value as Json;
}

export function asArray(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new WorkflowDefinitionError(`${where}: expected a list`);
  }
  return value;
}

export function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new WorkflowDefinitionError(`${where}: expected a non-empty string`);
  }
  return value;
}

export function optionalStrings(value: unknown, where: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return asArray(value, where).map(item => requireString(item, where));
}

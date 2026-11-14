/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { load } from 'js-yaml';
import {
  WorkflowDefinitionError,
  WorkflowGraph,
} from './graph';
import { kbflowParser } from './parsers/kbflow';
import { stepsParser } from './parsers/steps';

/** Turns one definition format into a {@link WorkflowGraph}. Extension point. */
export interface DefinitionParser {
  /** Stable id, used to select the parser explicitly (e.g. from config). */
  readonly format: string;
  /** Whether this parser recognises the raw document (auto-detection). */
  canParse(raw: unknown): boolean;
  /** Throws {@link WorkflowDefinitionError} on invalid input. */
  parse(raw: unknown): WorkflowGraph;
}

export const defaultParsers: readonly DefinitionParser[] = [
  kbflowParser,
  stepsParser,
];

/**
 * Parses an already-decoded definition (a YAML file or the input of a
 * workflow run). Uses `format` when given, otherwise the first parser that
 * recognises the document.
 */
export function parseWorkflowDefinition(
  raw: unknown,
  options: { format?: string; parsers?: readonly DefinitionParser[] } = {},
): WorkflowGraph {
  const parsers = options.parsers ?? defaultParsers;
  const parser = options.format
    ? parsers.find(p => p.format === options.format)
    : parsers.find(p => p.canParse(raw));
  if (!parser) {
    throw new WorkflowDefinitionError(
      options.format
        ? `unknown definition format "${options.format}"`
        : 'unrecognised workflow definition format',
    );
  }
  return parser.parse(raw);
}

/** Parses the text of a YAML workflow definition. */
export function parseWorkflowYaml(
  text: string,
  options: { format?: string; parsers?: readonly DefinitionParser[] } = {},
): WorkflowGraph {
  let raw: unknown;
  try {
    raw = load(text);
  } catch (error) {
    throw new WorkflowDefinitionError(
      `invalid YAML: ${(error as Error).message}`,
    );
  }
  return parseWorkflowDefinition(raw, options);
}

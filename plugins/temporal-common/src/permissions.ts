/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { createPermission } from '@backstage/plugin-permission-common';

/** List streams, schedules and runs; read definitions. */
export const temporalReadPermission = createPermission({
  name: 'temporal.read',
  attributes: { action: 'read' },
});

/** See run details that include task output (tails) and parameters. */
export const temporalRunReadPermission = createPermission({
  name: 'temporal.run.read',
  attributes: { action: 'read' },
});

export const temporalPermissions = [
  temporalReadPermission,
  temporalRunReadPermission,
];

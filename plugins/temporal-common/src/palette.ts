/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

// Colours by stage kind, matching the palette of `kbflow diagram` (command blue,
// K8s job violet, git green, publication yellow). Unknown kinds get grey.
export const KIND_COLORS: Record<string, string> = {
  cli: '#3b82f6',
  k8s_job: '#8b5cf6',
  git: '#10b981',
  kb_sync: '#eab308',
  qualify: '#ec4899',
  synthesize: '#f97316',
};

export const UNKNOWN_KIND_COLOR = '#6b7280';

export function kindColor(kind: string): string {
  return KIND_COLORS[kind] ?? UNKNOWN_KIND_COLOR;
}

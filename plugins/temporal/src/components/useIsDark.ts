/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useApi, appThemeApiRef } from '@backstage/frontend-plugin-api';

/** True when the active Backstage theme is the dark one. */
export function useIsDark(): boolean {
  const themes = useApi(appThemeApiRef);
  return themes.getActiveThemeId() === 'dark';
}

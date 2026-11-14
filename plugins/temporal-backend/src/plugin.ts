/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: MIT
 */

import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { temporalPermissions, TEMPORAL_PLUGIN_ID } from '@acarmisc/backstage-plugin-temporal-common';
import { readTemporalConfig } from './config';
import { createRouter } from './router';
import { TemporalService } from './service';

export const temporalPlugin = createBackendPlugin({
  pluginId: TEMPORAL_PLUGIN_ID,
  register(env) {
    env.registerInit({
      deps: {
        config: coreServices.rootConfig,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
        httpAuth: coreServices.httpAuth,
        permissions: coreServices.permissions,
        permissionsRegistry: coreServices.permissionsRegistry,
        urlReader: coreServices.urlReader,
      },
      async init({
        config,
        logger,
        httpRouter,
        httpAuth,
        permissions,
        permissionsRegistry,
        urlReader,
      }) {
        const temporalConfig = readTemporalConfig(config);
        const service = new TemporalService({ config: temporalConfig });

        permissionsRegistry.addPermissions(temporalPermissions);
        httpRouter.use(
          createRouter({ service, httpAuth, permissions, urlReader }),
        );
        logger.info(
          `Temporal plugin: ${temporalConfig.clusters.length} cluster(s) configured`,
        );
      },
    });
  },
});

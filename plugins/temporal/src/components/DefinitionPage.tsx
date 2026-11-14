/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useApi, discoveryApiRef, fetchApiRef } from '@backstage/frontend-plugin-api';
import { Content, Header, Page } from '@backstage/core-components';
import type { WorkflowGraph } from '@acarmisc/backstage-plugin-temporal-common';
import { WorkflowDiagram } from './WorkflowDiagram';
import { DiagramExport } from './DiagramExport';
import { useIsDark } from './useIsDark';

/**
 * Shows the diagram of a workflow definition stored in a repository, given by
 * `?location=<url of the YAML file>`. The backend reads it through UrlReader.
 */
export function DefinitionPage() {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);
  const dark = useIsDark();
  const location = new URLSearchParams(window.location.search).get('location') ?? '';
  const [graph, setGraph] = useState<WorkflowGraph>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!location) {
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const base = await discovery.getBaseUrl('temporal');
      const response = await fetchApi.fetch(
        `${base}/definitions?location=${encodeURIComponent(location)}`,
      );
      if (!response.ok) {
        throw new Error(`${response.status}: ${await response.text()}`);
      }
      return (await response.json()) as WorkflowGraph;
    })()
      .then(result => !cancelled && setGraph(result))
      .catch(err => !cancelled && setError(String((err as Error).message)));
    return () => {
      cancelled = true;
    };
  }, [discovery, fetchApi, location]);

  return (
    <Page themeId="tool">
      <Header title="Workflow definition" subtitle={location || 'Pass ?location=<url of a YAML file>'} />
      <Content>
        {error && <p role="alert">Could not load the definition: {error}</p>}
        {!error && !graph && location && <p>Loading…</p>}
        {graph && (
          <>
            <div style={{ marginBottom: 12 }}>
              <DiagramExport graph={graph} />
            </div>
            <div style={{ height: 520 }}>
              <WorkflowDiagram graph={graph} dark={dark} />
            </div>
          </>
        )}
      </Content>
    </Page>
  );
}

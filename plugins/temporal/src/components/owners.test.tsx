/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { renderHook, waitFor } from '@testing-library/react';

const getEntities = jest.fn();
const catalog = { getEntities };
jest.mock('@backstage/frontend-plugin-api', () => ({
  ...jest.requireActual('@backstage/frontend-plugin-api'),
  useApi: () => catalog,
}));

import { ownerOf, useStreamOwners } from './owners';

const entity = (name: string, stream: string, owner?: string) => ({
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: { name, namespace: 'default', annotations: { 'temporal.io/stream': stream } },
  spec: { owner },
});

describe('useStreamOwners', () => {
  beforeEach(() => getEntities.mockReset());

  it('maps stream names to owner and entity refs, skipping ownerless entities', async () => {
    getEntities.mockResolvedValue({ items: [entity('crm', 'crm-jira', 'team-a'), entity('x', 'x', undefined)] });
    const { result } = renderHook(() => useStreamOwners());

    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.get('crm-jira')).toEqual({
      ownerRef: 'group:default/team-a',
      entityRef: 'component:default/crm',
    });
    expect(getEntities).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { 'metadata.annotations.temporal.io/stream': expect.anything() } }),
    );
  });

  it('fails soft when the catalog call is denied', async () => {
    getEntities.mockRejectedValue(new Error('403'));
    const { result } = renderHook(() => useStreamOwners());
    await waitFor(() => expect(getEntities).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});

describe('ownerOf', () => {
  const o = (n: string) => ({ ownerRef: `group:default/${n}`, entityRef: `component:default/${n}` });
  const owners = new Map([['crm', o('a')], ['crm-jira', o('b')]]);

  it.each([
    ['stream/crm-jira', 'b'],
    ['stream/crm-jira/20261114T102908', 'b'],
    ['stream/crm-jira-2026-11-15T03:00:00Z', 'b'],
    ['stream/crm/20261114T102908', 'a'],
  ])('%s', (id, who) => expect(ownerOf(owners, id)?.ownerRef).toBe(`group:default/${who}`));

  it('does not match a longer name or unrelated ids', () => {
    expect(ownerOf(owners, 'stream/crmx')).toBeUndefined();
    expect(ownerOf(owners, 'order-42')).toBeUndefined();
  });
});

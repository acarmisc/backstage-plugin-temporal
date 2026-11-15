/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, screen } from '@testing-library/react';
import { JsonViewer } from './JsonViewer';

jest.mock('./useIsDark', () => ({ useIsDark: () => false }));

describe('JsonViewer', () => {
  it('numbers the lines and colours keys', () => {
    render(<JsonViewer value={{ name: 'x', count: 2 }} />);
    // {, "name", "count", } -> four lines
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('"name"')).toHaveAttribute('data-token', 'key');
    expect(screen.getByText('"name"')).toHaveStyle({ color: '#0369a1' });
  });

  it('pretty-prints a string that holds JSON', () => {
    render(<JsonViewer value='{"a":1}' />);
    expect(screen.getByText('"a"')).toHaveAttribute('data-token', 'key');
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

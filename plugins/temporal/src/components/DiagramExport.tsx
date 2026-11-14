/*
 * Copyright 2026 The Backstage Temporal plugin authors
 * SPDX-License-Identifier: Apache-2.0
 */

import { graphToMermaid, graphToSvg, type WorkflowGraph } from '@acarmisc/backstage-plugin-temporal-common';

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/** SVG rendered to a PNG on a canvas (2x for legibility). Resolves to null if the browser cannot. */
async function svgToPng(svg: string, width: number, height: number): Promise<Blob | null> {
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image failed to load'));
      image.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.scale(2, 2);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Export actions for a diagram: SVG, PNG, and the Mermaid source (for docs). */
export function DiagramExport({ graph }: { graph: WorkflowGraph }) {
  const exportSvg = () => {
    const svg = graphToSvg(graph);
    download(`${graph.name}.svg`, new Blob([svg], { type: 'image/svg+xml' }));
  };

  const exportPng = async () => {
    const svg = graphToSvg(graph);
    const size = svg.match(/width="(\d+)" height="(\d+)"/);
    const blob = await svgToPng(svg, Number(size?.[1] ?? 800), Number(size?.[2] ?? 600));
    if (blob) {
      download(`${graph.name}.png`, blob);
    }
  };

  const copyMermaid = async () => {
    await navigator.clipboard?.writeText(graphToMermaid(graph));
  };

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <button type="button" onClick={exportSvg}>SVG</button>
      <button type="button" onClick={exportPng}>PNG</button>
      <button type="button" onClick={copyMermaid}>Copy Mermaid</button>
    </div>
  );
}

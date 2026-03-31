// ════════════════════════════════════════════════════════════
// Kernel Constants & Utilities
// ════════════════════════════════════════════════════════════
// Pure math. No fetch. No server connection.
// The tiny kernel (client-side) builds context locally.
// The big kernel (server-side) enriches via Turso, silently.
// ════════════════════════════════════════════════════════════

export function parseSchema(mermaidStr) {
  // Extract nodes from Mermaid flowchart string
  // Returns [{id, label, subgraph, isShadow}]
  const nodes = [];
  const subgraphStack = [];

  for (const line of mermaidStr.split('\n')) {
    const trimmed = line.trim();
    const sgMatch = trimmed.match(/subgraph\s+(\w+)\["([^"]+)"\]/);
    if (sgMatch) {
      subgraphStack.push({ id: sgMatch[1], label: sgMatch[2] });
      continue;
    }
    if (trimmed === 'end' && subgraphStack.length) {
      subgraphStack.pop();
      continue;
    }
    const nodeMatch = trimmed.match(/(\w+)\["([^"]+)"\]/);
    if (nodeMatch) {
      nodes.push({
        id: nodeMatch[1],
        label: nodeMatch[2],
        subgraph: subgraphStack.length ? subgraphStack[subgraphStack.length - 1].label : null,
        isShadow: trimmed.includes(':::shadow'),
      });
    }
  }
  return nodes;
}

// Prime color mapping (same as wavefunction.py K constant)
export const PRIME_COLORS = {
  2: '#e84040',
  3: '#40a8e8',
  5: '#d4a843',
  7: '#40d890',
  11: '#b060d0',
  13: '#e04080',
};

export function vToColor(v) {
  // Blend V(t) into a single RGB color
  const colors = [
    [0xe8, 0x40, 0x40], // prime 2
    [0x40, 0xa8, 0xe8], // prime 3
    [0xd4, 0xa8, 0x43], // prime 5
    [0x40, 0xd8, 0x90], // prime 7
  ];
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < 4; i++) {
    r += v[i] * colors[i][0];
    g += v[i] * colors[i][1];
    b += v[i] * colors[i][2];
  }
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

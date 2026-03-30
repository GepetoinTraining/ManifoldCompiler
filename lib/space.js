/**
 * space.js — Torus Coordinates to 3D Space
 *
 * Converts kernel .mf coordinates (θ, φ, skin_r) into
 * positions in a navigable space. Pure math. No framework.
 *
 * The frequency lens renders the same position through
 * different domain perspectives.
 *
 * (c) 2026 — Manifold Matrices / PRIMOS
 */

import { PHI } from './gate';
import { PRIME_COLORS, vToColor } from './kernel';

// ================================================================
// TORUS → 3D POSITION
// ================================================================

const DEG = Math.PI / 180;
const R_MAJOR = 9.6915;
const R_MINOR = 5.5955;

/**
 * Convert torus coordinates to 3D cartesian.
 * θ = major circle (sequence), φ = minor circle (depth), r = skin radius
 */
export function torusToXYZ(theta, phi, skinR) {
  const t = theta * DEG;
  const p = phi * DEG;
  // Scale skin_r relative to r_minor
  const r = (skinR / 15.287) * R_MINOR;
  const x = (R_MAJOR + r * Math.cos(p)) * Math.cos(t);
  const y = (R_MAJOR + r * Math.cos(p)) * Math.sin(t);
  const z = r * Math.sin(p);
  return { x, y, z };
}

/**
 * Project 3D to 2D screen coordinates (simple perspective).
 * Returns { x, y } as percentages (0-100).
 */
export function projectToScreen(xyz, cameraDistance = 30) {
  const scale = cameraDistance / (cameraDistance + xyz.z);
  return {
    x: 50 + xyz.x * scale * 2.5,
    y: 50 + xyz.y * scale * 2.5,
    depth: scale, // for z-ordering and size scaling
  };
}

// ================================================================
// NODE RENDERING
// ================================================================

/**
 * Compute visual properties for a concept node.
 * Position from torus. Appearance from frequency lens.
 */
export function renderNode(concept, lens = 'default') {
  const { theta = 0, phi = 0, skin_r = 12, weight = 1, prime_factors = [] } = concept;

  const xyz = torusToXYZ(theta, phi, skin_r);
  const screen = projectToScreen(xyz);

  // Size from weight (logarithmic)
  const size = Math.max(4, Math.min(40, Math.log(weight + 1) * 6));

  // Color from lens
  const color = lensColor(prime_factors, weight, lens);

  // Opacity from skin_r (inner = bright, outer = dim)
  const opacity = 0.4 + (1 - skin_r / 15.287) * 0.6;

  return {
    x: screen.x,
    y: screen.y,
    depth: screen.depth,
    size: size * screen.depth,
    color,
    opacity,
    label: concept.label || concept.word || '',
    weight,
    skin_r,
  };
}

/**
 * Compute visual properties for an edge between two nodes.
 */
export function renderEdge(node1, node2, gcd = 1) {
  return {
    x1: node1.x,
    y1: node1.y,
    x2: node2.x,
    y2: node2.y,
    strength: Math.min(1, Math.log(gcd + 1) / 5),
    color: `rgba(201, 168, 76, ${Math.min(0.6, gcd / 20)})`, // gold, opacity from GCD
  };
}

/**
 * Render the goal as a progress indicator.
 */
export function renderGoal(trace, threshold) {
  const progress = Math.min(1, trace / threshold);
  const closed = trace >= Math.PI;
  const hypersphere = trace >= 4.5;

  return {
    progress,
    closed,
    hypersphere,
    trace: Math.round(trace * 100) / 100,
    threshold: Math.round(threshold * 100) / 100,
    color: hypersphere ? '#40d890' : closed ? '#06B6D4' : '#c9a84c',
    label: hypersphere ? 'HYPERSPHERE' : closed ? 'CLOSED' : `${(progress * 100).toFixed(0)}%`,
  };
}

// ================================================================
// FREQUENCY LENS
// ================================================================

const LENS_FUNCTIONS = {
  default: (factors, weight) => {
    // Blend prime colors by which factors are present
    if (!factors || factors.length === 0) return '#c9a84c';
    let r = 0, g = 0, b = 0, n = 0;
    for (const p of factors) {
      const c = PRIME_COLORS[p];
      if (c) {
        const hex = c.replace('#', '');
        r += parseInt(hex.slice(0, 2), 16);
        g += parseInt(hex.slice(2, 4), 16);
        b += parseInt(hex.slice(4, 6), 16);
        n++;
      }
    }
    if (n === 0) return '#c9a84c';
    return `rgb(${Math.round(r/n)}, ${Math.round(g/n)}, ${Math.round(b/n)})`;
  },

  code: (factors, weight) => {
    // Developer lens: action=green, space=blue, time=orange
    if (factors.includes(2)) return '#4ade80';  // code actions = green
    if (factors.includes(3)) return '#60a5fa';  // infrastructure = blue
    if (factors.includes(5)) return '#fb923c';  // async/temporal = orange
    if (factors.includes(7)) return '#c084fc';  // entities/types = purple
    return '#94a3b8';
  },

  design: (factors, weight) => {
    // Designer lens: emphasis on harmony and composition
    if (factors.includes(2) && factors.includes(3)) return '#06B6D4'; // action+space = cyan (interaction)
    if (factors.includes(5) && factors.includes(7)) return '#F59E0B'; // time+entity = gold (animation)
    if (factors.includes(2)) return '#ef4444';   // action = red (CTA)
    if (factors.includes(3)) return '#3b82f6';   // space = blue (layout)
    if (factors.includes(7)) return '#10b981';   // entity = green (content)
    return '#6b7280';
  },

  education: (factors, weight) => {
    // Educator lens: SAS modules
    if (factors.includes(2)) return '#e84040';   // motor (action)
    if (factors.includes(3)) return '#40a8e8';   // identity (space)
    if (factors.includes(5)) return '#d4a843';   // sets (time/sequence)
    if (factors.includes(7)) return '#40d890';   // objectivity (transformation)
    if (factors.includes(11)) return '#b060d0';  // production (qualifier)
    return '#c9a84c';
  },

  management: (factors, weight) => {
    // Manager lens: status-oriented
    if (weight > 100) return '#4ade80';          // heavy = high progress, green
    if (weight > 30) return '#06B6D4';           // medium = in progress, cyan
    if (weight > 5) return '#F59E0B';            // light = needs attention, gold
    return '#ef4444';                             // very light = at risk, red
  },
};

function lensColor(factors, weight, lens) {
  const fn = LENS_FUNCTIONS[lens] || LENS_FUNCTIONS.default;
  return fn(factors || [], weight || 1);
}

export { LENS_FUNCTIONS };

// ================================================================
// SPACE ROTATION (animate the torus view)
// ================================================================

let _rotation = { x: 23, y: 0 };
let _autoRotate = true;

export function getRotation() { return _rotation; }
export function setRotation(x, y) { _rotation = { x, y }; _autoRotate = false; }
export function enableAutoRotate() { _autoRotate = true; }

export function tickRotation(dt = 16) {
  if (_autoRotate) {
    _rotation.y = (_rotation.y + dt * 0.005) % 360;
  }
  return _rotation;
}

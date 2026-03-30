/**
 * lens.js — Frequency Table as Rendering Functions
 *
 * Same .mf coordinates. Different visual output.
 * The lens is a function, not a mode.
 * Member's L7 focus selects the default.
 * Users can switch manually.
 *
 * (c) 2026 — Manifold Matrices / PRIMOS
 */

import { PRIME_COLORS } from './kernel';

// Prime labels per domain
const DOMAIN_LABELS = {
  default: { 2: 'action', 3: 'space', 5: 'time', 7: 'entity', 11: 'qualifier', 13: 'negation' },
  code: { 2: 'function', 3: 'module', 5: 'async', 7: 'type', 11: 'validation', 13: 'error' },
  design: { 2: 'interaction', 3: 'layout', 5: 'animation', 7: 'content', 11: 'polish', 13: 'contrast' },
  education: { 2: 'motor', 3: 'identity', 5: 'sequence', 7: 'objectivity', 11: 'production', 13: 'boundary' },
  management: { 2: 'task', 3: 'resource', 5: 'deadline', 7: 'decision', 11: 'quality', 13: 'risk' },
  music: { 2: 'rhythm', 3: 'harmony', 5: 'melody', 7: 'timbre', 11: 'dynamics', 13: 'silence' },
  science: { 2: 'hypothesis', 3: 'method', 5: 'observation', 7: 'theory', 11: 'precision', 13: 'null result' },
};

/**
 * Get a label for a concept's prime factors through a domain lens.
 */
export function lensLabel(factors, lens = 'default') {
  const labels = DOMAIN_LABELS[lens] || DOMAIN_LABELS.default;
  if (!factors || factors.length === 0) return 'concept';

  // Use the dominant (first) factor's label
  const primary = factors[0];
  return labels[primary] || `p${primary}`;
}

/**
 * Get a composite label showing all factor meanings.
 */
export function lensCompositeLabel(factors, lens = 'default') {
  const labels = DOMAIN_LABELS[lens] || DOMAIN_LABELS.default;
  if (!factors || factors.length === 0) return '';
  return factors.map(p => labels[p] || `p${p}`).join(' + ');
}

/**
 * Select default lens from L7 focus keywords.
 */
export function lensFromFocus(focusArray) {
  if (!focusArray || focusArray.length === 0) return 'default';

  const keywords = focusArray.join(' ').toLowerCase();

  if (/code|engineer|dev|infrastructure|api|backend|frontend/.test(keywords)) return 'code';
  if (/design|ui|ux|visual|color|layout/.test(keywords)) return 'design';
  if (/edu|teach|learn|curriculum|student|sas/.test(keywords)) return 'education';
  if (/manage|lead|project|team|goal|deadline/.test(keywords)) return 'management';
  if (/music|audio|sound|compose|harmony/.test(keywords)) return 'music';
  if (/research|science|experiment|hypothesis/.test(keywords)) return 'science';

  return 'default';
}

export { DOMAIN_LABELS };

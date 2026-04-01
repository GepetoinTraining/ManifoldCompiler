/**
 * positronic-torus.schema.ts
 *
 * DB shape contract for the PositronicTorus component.
 * Fill this from Turso / any source and pass as `db` prop.
 *
 * Topology model:
 *
 *   SURFACE NODE (layer 0)
 *     └─ edge → LAYER NODE (prime layer 1–6)
 *                  └─ edge → LAYER NODE (deeper prime)
 *                               └─ edge → ... (arbitrary depth)
 *
 * Each node has a stable UUID address.
 * Each edge has a direction (inward | lateral | outward) and a weight.
 * The torus geometry is reconstructed from `torusConfig` at render time.
 */

// ---------------------------------------------------------------------------
// PRIMITIVES
// ---------------------------------------------------------------------------

export type PrimeIndex = 2 | 3 | 5 | 7 | 11 | 13

export type EdgeDirection = "inward" | "outward" | "lateral"

// ---------------------------------------------------------------------------
// GEOMETRY CONFIG  ← comes from DB, drives torus size
// ---------------------------------------------------------------------------

export interface TorusConfig {
  /** Major radius: center of torus to center of tube */
  R: number
  /** Minor radius: tube cross-section */
  r: number
  /** Segments around the ring (quality). Default: 64 */
  radialSegments?: number
  /** Segments around the tube (quality). Default: 32 */
  tubularSegments?: number
  /** Trefoil lift above surface. Default: 0.05 */
  trefoilLift?: number
}

// ---------------------------------------------------------------------------
// NODE
// ---------------------------------------------------------------------------

export interface TorusNode {
  /** Stable UUID — this is the DB address */
  id: string

  /**
   * Geometric address on the torus surface or interior.
   * u ∈ [0,1] = position around the ring
   * v ∈ [0,1] = position around the tube cross-section
   * depth ∈ [0,1] = 0 = surface, 1 = torus center axis
   */
  address: {
    u: number
    v: number
    depth: number
  }

  /** Which prime semantic layer this node belongs to */
  prime: PrimeIndex

  /** Human label */
  label: string

  /**
   * Arbitrary payload — your data lives here.
   * Cast to your domain type at the consumer.
   * Examples: { word: string }, { concept: string, weight: number }
   */
  payload: Record<string, unknown>

  /** Visual state hints (optional — component can manage these internally) */
  visual?: {
    color?: string       // override Balmer default
    scale?: number       // node sphere size multiplier
    emissive?: boolean   // glow
  }
}

// ---------------------------------------------------------------------------
// EDGE
// ---------------------------------------------------------------------------

export interface TorusEdge {
  id: string
  source: string         // node UUID
  target: string         // node UUID
  direction: EdgeDirection
  /** Semantic weight ∈ [0,1] — drives edge thickness in viewer */
  weight: number
  /** Optional label (e.g. relation type: "resonates", "bonds", "signals") */
  label?: string
}

// ---------------------------------------------------------------------------
// FULL DB PAYLOAD  ← what you pass as the `db` prop
// ---------------------------------------------------------------------------

export interface PositronicTorusDB {
  /** Drives physical torus size and resolution */
  torusConfig: TorusConfig

  /** All addressable nodes */
  nodes: TorusNode[]

  /** All edges connecting them */
  edges: TorusEdge[]

  /** Optional metadata */
  meta?: {
    name?: string
    version?: string
    createdAt?: string
    [key: string]: unknown
  }
}

// ---------------------------------------------------------------------------
// EXAMPLE SEED  ← delete before production, useful for dev
// ---------------------------------------------------------------------------

export const EXAMPLE_DB: PositronicTorusDB = {
  torusConfig: {
    R: 1.0,
    r: 0.35,
    radialSegments: 64,
    tubularSegments: 32,
    trefoilLift: 0.05,
  },
  meta: {
    name: "positronic-brain-v1",
    version: "0.1.0",
    createdAt: "2026-04-01",
  },
  nodes: [
    {
      id: "n-0001",
      address: { u: 0.0, v: 0.0, depth: 0 },
      prime: 2,
      label: "identity-root",
      payload: { concept: "self", weight: 1.0 },
    },
    {
      id: "n-0002",
      address: { u: 0.0, v: 0.0, depth: 0.4 },
      prime: 3,
      label: "space-anchor",
      payload: { concept: "coordinate origin", weight: 0.8 },
    },
    {
      id: "n-0003",
      address: { u: 0.16, v: 0.5, depth: 0 },
      prime: 5,
      label: "time-marker-1",
      payload: { concept: "t=0 reference", weight: 0.6 },
    },
    {
      id: "n-0004",
      address: { u: 0.33, v: 0.25, depth: 0.7 },
      prime: 7,
      label: "rotation-core",
      payload: { concept: "angular momentum seed", weight: 0.9 },
    },
  ],
  edges: [
    {
      id: "e-0001",
      source: "n-0001",
      target: "n-0002",
      direction: "inward",
      weight: 0.9,
      label: "grounds",
    },
    {
      id: "e-0002",
      source: "n-0002",
      target: "n-0004",
      direction: "inward",
      weight: 0.7,
      label: "rotates-through",
    },
    {
      id: "e-0003",
      source: "n-0001",
      target: "n-0003",
      direction: "lateral",
      weight: 0.5,
      label: "precedes",
    },
  ],
}
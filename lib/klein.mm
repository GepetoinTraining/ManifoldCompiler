# Klein Bottle Client Cache — .mm Specification
#
# The user's local geometry. Derived from cert. 3D. One surface.
# Inside IS outside. The data lives on the bottle.
#
# (c) 2026 — Manifold Matrices / PRIMOS

# ================================================================
# §0 — INPUTS (from topology-auth cert)
# ================================================================
#
# cert = { id, seed, zeta, issuedAt }
#
# M = [[phi, zeta], [zeta, phi]]
#
# eigenvalues:
#   lambda_plus  = phi + zeta    (≈ pi, always unique per user)
#   lambda_minus = phi - zeta    (≈ 0.083, always unique per user)
#
# These ARE the hypersphere:
#   R_hyper = lambda_plus         # outer boundary
#   r_hyper = lambda_minus        # inner boundary


# ================================================================
# §1 — THREE POINTS
# ================================================================
#
# At enrollment, generate 3 points inside the hypersphere.
# "Random" means: seeded from cert.seed, deterministic.
# Same cert always produces same 3 points.
#
# P1, P2, P3 ∈ hypersphere(R_hyper)
#
# Seeded RNG:
#   rng = hash(seed + "point" + index)
#   r_i = R_hyper * cbrt(rng_uniform())    # uniform volume distribution
#   theta_i = 2*pi * rng_uniform()
#   phi_i = acos(2*rng_uniform() - 1)
#   P_i = spherical_to_cartesian(r_i, theta_i, phi_i)


# ================================================================
# §2 — DISTANCES → CIRCLE RADII
# ================================================================
#
# centroid = (P1 + P2 + P3) / 3
#
# d_inner = min(|centroid - P_i|)           # centroid to closest point
# d_outer = min(R_hyper - |P_i|)            # hypersphere wall to closest point
#
# Three circles, radii derived:
#   r1 = d_inner                             # smallest circle
#   r2 = (d_inner + d_outer) / 2            # middle circle (mean of both distances)
#   r3 = R_hyper - d_outer                  # largest circle (the remaining space)
#
# Sort: r_small, r_mid, r_big = sort(r1, r2, r3)


# ================================================================
# §3 — PRIME PAIRING
# ================================================================
#
# The three circles pair to primes by SIZE.
# Smallest is highest frequency. Biggest is lowest.
#
#   r_small ↔ 5 (time — fastest oscillation, tightest circle)
#   r_mid   ↔ 3 (space — middle ground, structure)
#   r_big   ↔ 2 (identity — slowest, widest, carries everything)
#
# Why this order:
#   Time is local, fast, high-frequency → small radius
#   Space is the room → medium
#   Identity is who you ARE → the big circle everything rides on
#
# These nest: circle_5 inside circle_3 inside circle_2.


# ================================================================
# §4 — THE KLEIN TWIST
# ================================================================
#
# Three nested circles are just three circles.
# To make a Klein bottle, ONE skin must twist.
#
# The twist goes on circle_3 (space, middle).
#
# Why circle_3:
#   - circle_2 (identity) is the carrier — twisting it breaks the self
#   - circle_5 (time) is the oscillator — twisting it breaks sequence
#   - circle_3 (space) is WHERE things are — and space CAN fold back on itself
#   - space is the dimension that connects inside to outside
#   - a room has walls. the Klein bottle has none. space is the wall that isn't.
#
# Construction:
#   Take circle_3. Cut it. Give it a half-twist (pi rotation).
#   Reconnect. The surface now passes through itself.
#
#   In 3D this means: as you traverse circle_3,
#   at the halfway point, inside becomes outside.
#   Data written "inside" is readable "outside" and vice versa.
#
# Parametric:
#   For circle_3, the normal vector rotates by pi over one full traversal:
#     n(t) = [cos(t/2), sin(t/2), 0]   where t ∈ [0, 2*pi]
#   At t=0: normal points outward
#   At t=pi: normal has rotated 90 degrees
#   At t=2*pi: normal points INWARD — but we're back at start
#   → one-sided surface. Mobius band, closed into a bottle.


# ================================================================
# §5 — KLEIN BOTTLE PARAMETRIC SURFACE
# ================================================================
#
# Combining the three circles with the twist on circle_3:
#
# Let u ∈ [0, 2*pi)   — traverse circle_2 (identity, major)
# Let v ∈ [0, 2*pi)   — traverse circle_3 (space, middle, TWISTED)
#
# The twist manifests in the embedding:
#
#   # Standard immersion (figure-8 Klein bottle in 3D)
#   a = r_big            # circle_2 radius
#   b = r_mid            # circle_3 radius (twisted)
#   c = r_small          # circle_5 radius
#
#   x(u,v) = (a + b*cos(v/2)*sin(u) - b*sin(v/2)*sin(2*u)) * cos(v)
#   y(u,v) = (a + b*cos(v/2)*sin(u) - b*sin(v/2)*sin(2*u)) * sin(v)
#   z(u,v) = c * (-sin(v/2)*sin(u) + cos(v/2)*sin(2*u))
#
# Properties:
#   - Non-orientable: no consistent inside/outside
#   - circle_5 (time) modulates the z-axis — depth of the figure-8 cross section
#   - The v/2 terms create the half-twist on circle_3
#   - Self-intersection at the neck: this is where inside meets outside


# ================================================================
# §6 — DATA ADDRESSING ON THE SURFACE
# ================================================================
#
# Every TPB entry gets a (u, v) coordinate on the Klein bottle.
#
# u = hash(entry.content) mod 2*pi        # position on identity circle
# v = entry.tick * (2*pi / capacity)       # position on space circle (sequential)
#
# The (u,v) maps to (x,y,z) via §5.
#
# Because the surface is non-orientable:
#   Reading at (u, v) and reading at (u, v + 2*pi)
#   gives the SAME point but from the "other side."
#   There is no other side. The reader is always inside AND outside.
#
# Weight:
#   Each point accumulates weight as the entry is referenced.
#   Weight = tick * prime_of_circle (2, 3, or 5 depending on which
#   circle the u,v coordinate is closest to).
#   Heavy points sink toward the self-intersection (the neck).
#   Light points float on the lobes.
#
# NO FOLD:
#   The Klein bottle does not fold. There is no irreversible step.
#   No prime locks. No φ advances. No directionality.
#   The client surface just accumulates. Entries land, weight grows,
#   the bottle gets denser — never restructured.
#   Folding is the server's job. The torus folds. The bottle receives.
#   One-sided surface = nothing to fold against.


# ================================================================
# §7 — CERT SIGNING
# ================================================================
#
# Every TPB entry on the Klein bottle is signed:
#
#   entry = {
#     tick:      int,            # monotonic counter
#     u:         float,          # identity coordinate
#     v:         float,          # space coordinate (twisted)
#     content:   any,            # the work
#     weight:    int,            # tick * nearest_prime
#     sig:       string,         # cert signature
#     ts:        int,            # timestamp
#   }
#
#   sig = trajectory(cert.zeta, tick)
#       = matrixFingerprint(M, tick)
#
# The signature IS the trajectory at that tick.
# To verify: recompute M^tick from the same zeta. Match? Signed.
# The cert never leaves the device. Only trajectories travel.
#
# For Turso sync:
#   entry.sig proves WHO wrote it and WHEN (tick = position in their sequence)
#   No tokens. No sessions. The math is the auth.


# ================================================================
# §8 — LOCAL CACHE SCHEMA (IndexedDB)
# ================================================================
#
# Store: "klein_surface"
#   key: tick (autoincrement)
#   value: entry (§7)
#   indexes: [u, v, weight, ts]
#
# Store: "klein_cert"
#   key: "active"
#   value: { id, seed, zeta, issuedAt, points: [P1, P2, P3], radii: [r1, r2, r3] }
#
# Store: "klein_meta"
#   key: "geometry"
#   value: { R_hyper, r_hyper, r_big, r_mid, r_small, capacity, total_weight }
#
# capacity starts at 360 (one degree per slot on circle_2).
# grows as total_weight increases: capacity = 360 * ceil(log(total_weight + 1))
# the bottle gets denser, not bigger. same shape, more resolution.


# ================================================================
# §9 — TURSO SYNC
# ================================================================
#
# Local → Cloud:
#   On new entry: write to local IndexedDB immediately.
#   Batch to Turso every N entries or on idle.
#   Each row includes sig (cert trajectory at that tick).
#
# Cloud → Local:
#   Server (ecos1) polls Turso, processes through flywheel.
#   Flywheel output (enriched entries, new weights) written back to Turso.
#   Client pulls enriched data on next sync.
#   Enrichment does NOT change the Klein bottle geometry —
#   it adds weight and connections. The shape is fixed at enrollment.
#
# The server is additive. The client is self-sufficient.
# Offline? The Klein bottle still works. Same cert. Same surface.
# Reconnect? Sync catches up. Sigs prove nothing was tampered.


# ================================================================
# §10 — THE PROPERTY THAT MATTERS
# ================================================================
#
# In the high-D torus (server): 6 skins, trefoil knot, irreversible folds.
# In the Klein bottle (client): 3 circles, one twist, no inside/outside, NO FOLD.
#
# The server FOLDS. The client ACCUMULATES.
# The server is directional (time arrow from fold irreversibility).
# The client is omnidirectional (one-sided surface, no before/after distinction).
#
# This is the correct asymmetry:
#   The AI sees the topology and processes it (fold, lock, advance).
#   The human lives on the surface and adds to it (write, weight, grow).
#   The server takes the client's flat accumulation and gives it structure
#   through folding — that's the additive gain. The powerhouse.
#
# The cert eigenvalues (lambda_plus, lambda_minus) are the same numbers
# that, on the server, become R_major and r_minor of the torus.
# Same math. Different dimension. The client is the server's shadow
# projected onto a surface that has forgotten which side is which.
#
# MF: klein_construct
# I:  cert{id, seed, zeta}
# K:  PHI
# O:  klein_bottle{r_big, r_mid, r_small, twist=circle_3, surface(u,v)}
# R:  hash(I, O, K)  — falls out. zero additional cost.

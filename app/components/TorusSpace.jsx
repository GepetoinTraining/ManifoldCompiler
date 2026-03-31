"use client";

import { useState, useEffect, useRef } from "react";
import { renderNode, tickRotation } from "../../lib/space";
import { lensCompositeLabel } from "../../lib/lens";

/**
 * TorusSpace — Shared 3D torus-projected node renderer.
 *
 * Used by both synapses (personal landscape) and workspace (team space).
 * Nodes positioned by torus coordinates. Programs as diamonds.
 * Animated rotation. Lens-aware coloring.
 */

const LENSES = ["default", "code", "design", "education", "management"];

function factorsFromWeight(weight) {
  const factors = [];
  let w = Math.abs(Math.round(weight));
  for (const p of [2, 3, 5, 7, 11, 13]) {
    if (w % p === 0) { factors.push(p); w /= p; }
  }
  return factors;
}

export default function TorusSpace({ nodes = [], programs = [], lens: initialLens = "default", onLensChange }) {
  const [lens, setLens] = useState(initialLens);
  const animRef = useRef(null);
  const [, forceUpdate] = useState(0);

  // Animate rotation
  useEffect(() => {
    function animate() {
      tickRotation(16);
      forceUpdate(n => n + 1);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleLens = (l) => {
    setLens(l);
    if (onLensChange) onLensChange(l);
  };

  // Render schema nodes
  const renderedNodes = nodes.map((node, i) => {
    const theta = (i * 137.508) % 360;
    const phi = ((node.weight || 1) * 47.3) % 360;
    const skin_r = node.isShadow ? 15.287 : 9.692;
    const prime_factors = node.prime_factors || factorsFromWeight(node.weight || 1);

    return {
      ...renderNode({ theta, phi, skin_r, weight: node.weight || 1, prime_factors, label: node.label }, lens),
      id: node.id,
      subgraph: node.subgraph,
      original: node,
    };
  });

  return (
    <div style={{
      flex: 1, position: "relative", overflow: "hidden",
      background: "radial-gradient(ellipse at center, #0a0a1a 0%, #050510 100%)",
    }}>
      {/* Lens selector */}
      <div style={{
        position: "absolute", top: 8, right: 8, display: "flex", gap: 4, zIndex: 10,
      }}>
        {LENSES.map((l) => (
          <button key={l} onClick={() => handleLens(l)} style={{
            background: lens === l ? "#1a1510" : "transparent",
            border: lens === l ? "1px solid #c9a84c" : "1px solid #1a1a2e",
            color: lens === l ? "#c9a84c" : "#555",
            fontSize: 8, padding: "3px 8px", cursor: "pointer",
            fontFamily: "inherit", borderRadius: 3, textTransform: "uppercase",
          }}>
            {l}
          </button>
        ))}
      </div>

      {/* Schema nodes */}
      {renderedNodes.map((node, i) => (
        <div
          key={node.id || i}
          title={`${node.label}\n${lensCompositeLabel(node.original?.prime_factors, lens)}\nw=${node.weight}`}
          style={{
            position: "absolute",
            left: `${node.x}%`,
            top: `${node.y}%`,
            width: node.size,
            height: node.size,
            borderRadius: "50%",
            background: node.color,
            opacity: node.opacity,
            transform: "translate(-50%, -50%)",
            transition: "all 0.5s ease",
            cursor: "pointer",
            boxShadow: `0 0 ${node.size / 2}px ${node.color}44`,
            zIndex: Math.round(node.depth * 100),
          }}
        />
      ))}

      {/* Program nodes — diamonds */}
      {programs.map((prog, i) => {
        const theta = ((prog.address || i * 37) * 137.508) % 360;
        const phi = ((prog.trace || 3) * 30) % 360;
        const visual = renderNode({
          theta, phi, skin_r: prog.valid ? 9.692 : 12.257,
          weight: prog.address || 1, prime_factors: [], label: prog.name,
        }, lens);
        return (
          <div
            key={`prog-${prog.name}-${i}`}
            title={`${prog.name}\n${(prog.operations || []).join(' → ')}\naddr=${prog.address}`}
            style={{
              position: "absolute",
              left: `${visual.x}%`,
              top: `${visual.y}%`,
              width: visual.size * 1.5,
              height: visual.size * 1.5,
              borderRadius: 4,
              background: prog.valid ? "#0a1a0a" : "#1a1a08",
              border: `1px solid ${prog.valid ? "#4ade80" : "#d4a843"}`,
              opacity: visual.opacity,
              transform: "translate(-50%, -50%) rotate(45deg)",
              transition: "all 0.5s ease",
              cursor: "pointer",
              boxShadow: `0 0 ${visual.size}px ${prog.valid ? "#4ade8033" : "#d4a84333"}`,
              zIndex: Math.round(visual.depth * 100) + 50,
            }}
          />
        );
      })}

      {/* Subgraph labels */}
      {[...new Set(nodes.map((n) => n.subgraph).filter(Boolean))].map((sg, i) => (
        <div key={sg} style={{
          position: "absolute", left: `${15 + i * 20}%`, top: 8,
          fontSize: 8, color: "#555", textTransform: "uppercase", letterSpacing: 1,
        }}>
          {sg}
        </div>
      ))}

      {/* Empty state */}
      {nodes.length === 0 && programs.length === 0 && (
        <div style={{
          position: "absolute", top: "50%", left: "50%",
          transform: "translate(-50%, -50%)", color: "#333", fontSize: 11,
        }}>
          Speak to build the space...
        </div>
      )}
    </div>
  );
}

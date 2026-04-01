"use client";

import { useEffect, useRef, useCallback } from "react";
import { torusToXYZ, projectToScreen } from "../../lib/space";
import { PRIME_COLORS } from "../../lib/kernel";

/**
 * TorusCanvas — Real torus wireframe using space.js math.
 *
 * Uses torusToXYZ(theta, phi, skinR) to compute 3D positions,
 * then projectToScreen() for perspective. All from the manifold math.
 *
 * Props:
 *   words    — Array of { word, theta, phi, count, mask }
 *   currentV — [p2, p3, p5, p7] voice vector
 *   register — Current register label
 *   vToColor — Function from kernel.js
 */

// Schema-aligned defaults (from example-torus.ts TorusConfig)
const TORUS_R = 9.6915;   // R_MAJOR from space.js (matches TorusConfig.R scaled)
const TORUS_r = 5.5955;   // R_MINOR from space.js (matches TorusConfig.r scaled)
const RADIAL_SEGMENTS = 48;
const TUBULAR_SEGMENTS = 24;
const SKIN_R_SURFACE = 15.287; // surface skin radius

const PRIME_BAR_COLORS = ["#e84040", "#40a8e8", "#d4a843", "#40d890"];
const PRIME_LABELS = ["2", "3", "5", "7"];

export default function TorusCanvas({ words = [], currentV = [0.25, 0.25, 0.25, 0.25], register = "grounded", vToColor }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const rotationRef = useRef({ y: 0 });
  const mouseRef = useRef({ down: false, lastX: 0, dragY: 0 });

  const draw = useCallback((ctx, width, height, rotation) => {
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const scale = Math.min(width, height) / 38; // fit torus in view
    const camDist = 30;
    const cosR = Math.cos(rotation.y);
    const sinR = Math.sin(rotation.y);
    // Slight tilt for 3D feel
    const tiltX = 23 * Math.PI / 180;
    const cosT = Math.cos(tiltX);
    const sinT = Math.sin(tiltX);

    // Transform: rotate Y then tilt X
    function transform(xyz) {
      // Rotate around Y axis
      let x = xyz.x * cosR - xyz.z * sinR;
      let z = xyz.x * sinR + xyz.z * cosR;
      let y = xyz.y;
      // Tilt around X axis
      let y2 = y * cosT - z * sinT;
      let z2 = y * sinT + z * cosT;
      // Perspective
      const perspective = camDist / (camDist + z2);
      return {
        sx: cx + x * perspective * scale,
        sy: cy + y2 * perspective * scale,
        depth: z2,
        perspective,
      };
    }

    // ──── Draw wireframe torus ────
    // Meridians (around the tube cross-section)
    ctx.strokeStyle = "rgba(201, 168, 76, 0.06)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i < RADIAL_SEGMENTS; i++) {
      const theta = (i / RADIAL_SEGMENTS) * 360;
      ctx.beginPath();
      for (let j = 0; j <= TUBULAR_SEGMENTS; j++) {
        const phi = (j / TUBULAR_SEGMENTS) * 360;
        const xyz = torusToXYZ(theta, phi, SKIN_R_SURFACE);
        const s = transform(xyz);
        if (j === 0) ctx.moveTo(s.sx, s.sy);
        else ctx.lineTo(s.sx, s.sy);
      }
      ctx.stroke();
    }

    // Parallels (around the ring)
    ctx.strokeStyle = "rgba(201, 168, 76, 0.04)";
    for (let j = 0; j < TUBULAR_SEGMENTS; j++) {
      const phi = (j / TUBULAR_SEGMENTS) * 360;
      ctx.beginPath();
      for (let i = 0; i <= RADIAL_SEGMENTS; i++) {
        const theta = (i / RADIAL_SEGMENTS) * 360;
        const xyz = torusToXYZ(theta, phi, SKIN_R_SURFACE);
        const s = transform(xyz);
        if (i === 0) ctx.moveTo(s.sx, s.sy);
        else ctx.lineTo(s.sx, s.sy);
      }
      ctx.stroke();
    }

    // ──── Draw trefoil reference curve ────
    ctx.strokeStyle = "rgba(201, 168, 76, 0.12)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 0; t <= 360; t += 2) {
      // Trefoil knot: (2,3) torus knot
      const theta = t * 2;  // winds 2x around ring
      const phi = t * 3;    // winds 3x around tube
      const xyz = torusToXYZ(theta % 360, phi % 360, SKIN_R_SURFACE * 1.02);
      const s = transform(xyz);
      if (t === 0) ctx.moveTo(s.sx, s.sy);
      else ctx.lineTo(s.sx, s.sy);
    }
    ctx.stroke();

    // ──── Plot words on torus surface ────
    // Sort by depth so far points draw first (painter's algorithm)
    const wordVisuals = words.map((w) => {
      const theta = w.theta || 0;
      const phi = w.phi || 0;
      const xyz = torusToXYZ(theta, phi, SKIN_R_SURFACE);
      const s = transform(xyz);
      const mask = w.mask || 0;
      const color =
        mask & 1 ? PRIME_COLORS[2] :
        mask & 2 ? PRIME_COLORS[3] :
        mask & 4 ? PRIME_COLORS[5] :
        mask & 8 ? PRIME_COLORS[7] :
        "#888";
      const count = w.count || 1;
      const radius = Math.max(1.5, Math.min(6, Math.log(count + 1) * 1.8)) * s.perspective;
      const opacity = Math.min(0.95, 0.25 + count * 0.06);

      return { ...s, color, radius, opacity, word: w.word, count, theta, mask };
    });

    wordVisuals.sort((a, b) => b.depth - a.depth); // far-to-near

    for (const wv of wordVisuals) {
      // Glow
      if (wv.count > 2) {
        const grd = ctx.createRadialGradient(wv.sx, wv.sy, 0, wv.sx, wv.sy, wv.radius * 4);
        grd.addColorStop(0, wv.color + "30");
        grd.addColorStop(1, "transparent");
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(wv.sx, wv.sy, wv.radius * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node dot
      ctx.globalAlpha = wv.opacity;
      ctx.fillStyle = wv.color;
      ctx.beginPath();
      ctx.arc(wv.sx, wv.sy, wv.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ──── Draw edges between nearby words (lateral connections) ────
    if (wordVisuals.length > 1 && wordVisuals.length < 200) {
      ctx.strokeStyle = "rgba(201, 168, 76, 0.04)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i < wordVisuals.length - 1; i++) {
        const a = wordVisuals[i];
        const b = wordVisuals[i + 1];
        // Only connect if same mask (same prime layer)
        if (a.mask === b.mask && a.mask > 0) {
          ctx.beginPath();
          ctx.moveTo(a.sx, a.sy);
          ctx.lineTo(b.sx, b.sy);
          ctx.stroke();
        }
      }
    }
  }, [words]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    let running = true;

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function loop() {
      if (!running) return;
      const rot = rotationRef.current;
      if (!mouseRef.current.down) {
        rot.y += 0.004; // auto-rotate
      }
      const rect = canvas.parentElement.getBoundingClientRect();
      draw(ctx, rect.width, rect.height, rot);
      animRef.current = requestAnimationFrame(loop);
    }
    animRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [draw]);

  // Mouse drag to rotate
  function handleMouseDown(e) {
    mouseRef.current.down = true;
    mouseRef.current.lastX = e.clientX;
  }
  function handleMouseMove(e) {
    if (!mouseRef.current.down) return;
    const dx = e.clientX - mouseRef.current.lastX;
    rotationRef.current.y += dx * 0.005;
    mouseRef.current.lastX = e.clientX;
  }
  function handleMouseUp() {
    mouseRef.current.down = false;
  }

  const vColor = vToColor ? vToColor(currentV) : "#c9a84c";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", cursor: "grab" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Header label */}
      <div style={{
        position: "absolute", top: 6, left: 8,
        fontSize: 8, color: "#444", letterSpacing: 1, textTransform: "uppercase",
      }}>
        Torus — {words.length}w
      </div>

      {/* V(t) overlay — bottom left */}
      <div style={{
        position: "absolute", bottom: 6, left: 8,
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {currentV.map((val, i) => (
          <div key={i} title={`p${PRIME_LABELS[i]}: ${(val * 100).toFixed(0)}%`} style={{
            width: Math.max(6, val * 50), height: 8,
            background: PRIME_BAR_COLORS[i],
            opacity: 0.3 + val * 0.7,
            borderRadius: 2, transition: "all 0.3s",
          }} />
        ))}
        <div style={{
          width: 8, height: 8, borderRadius: "50%",
          background: vColor,
          boxShadow: `0 0 4px ${vColor}`,
        }} />
        <span style={{
          fontSize: 8, color: "#555",
          textTransform: "uppercase", letterSpacing: 1,
        }}>
          {register}
        </span>
      </div>
    </div>
  );
}

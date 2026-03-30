"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { kernelTurn, parseSchema, PRIME_COLORS, vToColor } from "../../../lib/kernel";
import { renderNode, renderEdge, renderGoal, tickRotation, getRotation } from "../../../lib/space";
import { lensLabel, lensCompositeLabel, lensFromFocus } from "../../../lib/lens";
import { useParams } from "next/navigation";

const KERNEL_URL = "";
const PRIME_BAR_COLORS = ["#e84040", "#40a8e8", "#d4a843", "#40d890"];

function factorsFromWeight(weight) {
  const factors = [];
  let w = Math.abs(Math.round(weight));
  for (const p of [2, 3, 5, 7, 11, 13]) {
    if (w % p === 0) { factors.push(p); w /= p; }
  }
  return factors;
}

export default function WorkspacePage() {
  const params = useParams();
  const teamId = params.team_id;

  const [uuid, setUuid] = useState(null);
  const [team, setTeam] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [goal, setGoal] = useState(null);
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentV, setCurrentV] = useState([0.25, 0.25, 0.25, 0.25]);
  const [register, setRegister] = useState("grounded");
  const [lens, setLens] = useState("default");
  const [members, setMembers] = useState([]);
  const spaceRef = useRef(null);
  const convRef = useRef(null);
  const animRef = useRef(null);

  // Auth
  useEffect(() => {
    const stored = localStorage.getItem("torus_uuid");
    if (stored) setUuid(stored);
    else window.location.href = "/synapses";
  }, []);

  // Load team
  useEffect(() => {
    if (!uuid || !teamId) return;

    fetch(`/api/proxy/team/schema?team_id=${teamId}&uuid=${uuid}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.O) {
          const d = data.O;
          setTeam(d.team);
          setMembers(d.team?.members ? [] : []);

          // Parse schema to nodes
          if (d.schema) {
            const parsed = parseSchema(d.schema);
            const enriched = parsed.map((n) => {
              const weight = parseFloat(n.label.match(/w=([\d.]+)/)?.[1] || "1");
              const factors = factorsFromWeight(weight);
              return { ...n, weight, prime_factors: factors };
            });
            setNodes(enriched);
          }

          // Set lens from L7 focus
          if (d.team?.focus) {
            setLens(lensFromFocus(d.team.focus));
          }
        }
      })
      .catch((e) => setError(e.message));
  }, [uuid, teamId]);

  // Auto-scroll conversation
  useEffect(() => {
    convRef.current?.scrollTo(0, convRef.current.scrollHeight);
  }, [turns]);

  // Animate rotation
  useEffect(() => {
    function animate() {
      tickRotation(16);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  // Submit message
  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setLoading(true);
    setError(null);

    setTurns((prev) => [...prev, { role: "user", text: userMessage }]);

    try {
      // Step 1: kernel state update
      const kernelState = await kernelTurn(uuid, userMessage);
      const schema = kernelState?.schema || "";

      // Step 2: call LLM
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          schema,
          history: turns.map((t) => ({
            role: t.role === "user" ? "user" : "assistant",
            text: t.text,
          })),
          model_tier: "sonnet",
          uuid,
        }),
      });
      const chatData = await chatRes.json();

      if (chatData.error) {
        setError(chatData.error);
        setLoading(false);
        return;
      }

      const modelResponse = chatData.response || "";

      // Step 3: kernel enrichment
      const enrichment = await kernelTurn(uuid, null, modelResponse);

      // Update V(t)
      const v = enrichment?.v || enrichment?.voice?.v || currentV;
      const reg = enrichment?.register || enrichment?.voice?.register || register;
      setCurrentV(v);
      setRegister(reg);

      // Update nodes from enriched schema
      if (enrichment?.schema) {
        const parsed = parseSchema(typeof enrichment.schema === "string" ? enrichment.schema : "");
        const enrichedNodes = parsed.map((n) => {
          const weight = parseFloat(n.label.match(/w=([\d.]+)/)?.[1] || "1");
          return { ...n, weight, prime_factors: factorsFromWeight(weight) };
        });
        if (enrichedNodes.length > 0) setNodes(enrichedNodes);
      }

      // Add assistant turn
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: modelResponse,
          v: [...v],
          register: reg,
          imagination: enrichment?.imagination?.spawned || [],
        },
      ]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // Render nodes in the space
  const renderedNodes = nodes.map((node, i) => {
    const theta = (i * 137.508) % 360;
    const phi = ((node.weight || 1) * 47.3) % 360;
    const skin_r = node.isShadow ? 15.287 : 9.692;

    const visual = renderNode({
      theta,
      phi,
      skin_r,
      weight: node.weight || 1,
      prime_factors: node.prime_factors || [],
      label: node.label,
    }, lens);

    return { ...visual, id: node.id, subgraph: node.subgraph, original: node };
  });

  const LENSES = ["default", "code", "design", "education", "management"];

  return (
    <div style={{
      height: "100vh", width: "100vw", paddingTop: 50, boxSizing: "border-box",
      display: "flex", flexDirection: "column", background: "#050510",
      fontFamily: "'JetBrains Mono', monospace", color: "#e8d5a3", overflow: "hidden",
    }}>
      {/* Header bar */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "8px 16px", borderBottom: "1px solid #1a1a2e", flexShrink: 0,
        background: "#0a0a12",
      }}>
        <div>
          <span style={{ color: "#c9a84c", fontWeight: 700, fontSize: 13 }}>
            ⬡ {team?.name || "Workspace"}
          </span>
          {goal && (
            <span style={{ marginLeft: 12, fontSize: 10, color: goal.color }}>
              {goal.label} ({goal.trace}/{goal.threshold})
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {LENSES.map((l) => (
            <button key={l} onClick={() => setLens(l)} style={{
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
      </div>

      {/* Space + conversation split */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 3D Space */}
        <div ref={spaceRef} style={{
          flex: 1, position: "relative", overflow: "hidden",
          background: "radial-gradient(ellipse at center, #0a0a1a 0%, #050510 100%)",
        }}>
          {/* Nodes */}
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

          {/* Subgraph labels */}
          {[...new Set(nodes.map((n) => n.subgraph).filter(Boolean))].map((sg, i) => (
            <div key={sg} style={{
              position: "absolute",
              left: `${15 + i * 20}%`,
              top: 8,
              fontSize: 8,
              color: "#555",
              textTransform: "uppercase",
              letterSpacing: 1,
            }}>
              {sg}
            </div>
          ))}

          {/* Members online indicator */}
          {members.length > 0 && (
            <div style={{ position: "absolute", bottom: 8, left: 12, fontSize: 9, color: "#444" }}>
              {members.length} member{members.length > 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* Conversation panel */}
        <div style={{
          width: 380, display: "flex", flexDirection: "column",
          borderLeft: "1px solid #1a1a2e", background: "#0a0a0f",
        }}>
          {/* V(t) bar */}
          <div style={{
            display: "flex", height: 28, flexShrink: 0,
            borderBottom: "1px solid #1a1a2e",
          }}>
            {currentV.map((val, i) => (
              <div key={i} style={{
                flex: Math.max(0.05, val),
                background: PRIME_BAR_COLORS[i],
                opacity: 0.3 + val * 0.7,
                transition: "all 0.5s ease",
              }} />
            ))}
            <div style={{
              position: "absolute", right: 390, top: 58 + 4,
              fontSize: 8, color: "#555", padding: "0 6px",
            }}>
              {register}
            </div>
          </div>

          {/* Turns */}
          <div ref={convRef} style={{
            flex: 1, overflowY: "auto", padding: "8px 12px",
          }}>
            {turns.map((turn, i) => (
              <div key={i} style={{
                marginBottom: 12,
                paddingLeft: turn.role === "user" ? 0 : 8,
                borderLeft: turn.role === "user" ? "none" : `2px solid ${vToColor(turn.v || currentV)}`,
              }}>
                <div style={{
                  fontSize: 8, color: "#444", marginBottom: 2,
                  textTransform: "uppercase", letterSpacing: 1,
                }}>
                  {turn.role === "user" ? "you" : "synapse"}
                  {turn.register && ` · ${turn.register}`}
                </div>
                <div style={{
                  fontSize: 11, lineHeight: 1.618,
                  color: turn.role === "user" ? "#e8d5a3" : "#bbb",
                  whiteSpace: "pre-wrap",
                }}>
                  {turn.text}
                </div>
                {turn.imagination && turn.imagination.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {turn.imagination.map((s, j) => (
                      <span key={j} style={{
                        fontSize: 8, padding: "2px 6px", borderRadius: 8,
                        background: s.hypersphere ? "#1a3a1a" : s.closed ? "#1a2a3a" : "#3a1a1a",
                        color: s.hypersphere ? "#4ade80" : s.closed ? "#60a5fa" : "#f87171",
                      }}>
                        ◇ {s.name} t={s.trace}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ fontSize: 10, color: "#555", padding: 8 }}>
                ◇ thinking...
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{
            display: "flex", gap: 4, padding: 8,
            borderTop: "1px solid #1a1a2e", flexShrink: 0,
          }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="speak into the space..."
              disabled={loading}
              style={{
                flex: 1, background: "#0e0e14", border: "1px solid #1a1a2e",
                color: "#e8d5a3", fontFamily: "inherit", fontSize: 11,
                padding: "8px 10px", outline: "none", borderRadius: 4,
              }}
            />
            <button type="submit" disabled={loading} style={{
              background: "#1a1510", border: "1px solid #4a3d1f", color: "#c9a84c",
              fontFamily: "inherit", fontSize: 11, padding: "8px 14px",
              cursor: loading ? "default" : "pointer", borderRadius: 4,
              fontWeight: 600, opacity: loading ? 0.5 : 1,
            }}>
              ⬡
            </button>
          </form>

          {error && (
            <div style={{ padding: "4px 12px", fontSize: 9, color: "#8c4c4c" }}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

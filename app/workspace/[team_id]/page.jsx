"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseSchema, PRIME_COLORS, vToColor } from "../../../lib/kernel";
import { renderNode, renderEdge, renderGoal, tickRotation, getRotation } from "../../../lib/space";
import { lensLabel, lensCompositeLabel, lensFromFocus } from "../../../lib/lens";
import { openTranslateDB, ingest, composeContext, buildConversationGraph, composeContextFromGraph } from "../../../lib/translate";
import { useParams } from "next/navigation";

const PRIME_BAR_COLORS = ["#e84040", "#40a8e8", "#d4a843", "#40d890"];

function parseTags(text) {
  const imagines = [];
  const programs = [];
  let clean = text;
  clean = clean.replace(/<imagine\s+name="([^"]+)">([\s\S]*?)<\/imagine>/g, (_, name, content) => {
    imagines.push({ name, text: content.trim() });
    return '';
  });
  clean = clean.replace(/<program\s+name="([^"]+)">([\s\S]*?)<\/program>/g, (_, name, content) => {
    programs.push({ name, text: content.trim() });
    return '';
  });
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  return { clean, imagines, programs };
}

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
  const [localDB, setLocalDB] = useState(null);
  const [localTick, setLocalTick] = useState(0);
  const [programs, setPrograms] = useState([]);
  const spaceRef = useRef(null);
  const convRef = useRef(null);
  const animRef = useRef(null);

  // Auth
  useEffect(() => {
    const stored = localStorage.getItem("torus_uuid");
    if (stored) {
      setUuid(stored);
      openTranslateDB()
        .then((db) => {
          setLocalDB(db);
          const tx = db.transaction('surface', 'readonly');
          const req = tx.objectStore('surface').count();
          req.onsuccess = () => setLocalTick(req.result || 0);
        })
        .catch((err) => console.error('[klein] DB open failed:', err));
    } else {
      window.location.href = "/synapses";
    }
  }, []);

  // Load team
  useEffect(() => {
    if (!uuid || !teamId) return;

    // Team data comes from Turso via big kernel enrichment (future)
    // For now, use team_id as the workspace name
    setTeam({ name: `Team ${teamId}` });

    // Build initial context from local Klein bottle
    if (localDB) {
      composeContext(localDB, currentV, uuid)
        .then((ctx) => {
          if (ctx) {
            const fullSchema = 'flowchart TD\n' + ctx + '\n  classDef shadow fill:#333,color:#999,stroke:#555';
            const parsed = parseSchema(fullSchema);
            const enriched = parsed.map((n) => {
              const weight = parseFloat(n.label.match(/w=([\d.]+)/)?.[1] || n.label.match(/x(\d+)/)?.[1] || "1");
              const factors = factorsFromWeight(weight);
              return { ...n, weight, prime_factors: factors };
            });
            if (enriched.length > 0) setNodes(enriched);
          }
        })
        .catch((e) => setError(e.message));
    }
  }, [uuid, teamId, localDB]);

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
      // Step 1: Decompose into local Klein bottle — user voice
      let localV = currentV;
      let schema = '';
      if (localDB) {
        const ingested = await ingest(userMessage, localDB, localTick, 'user');
        setLocalTick(prev => prev + 1);
        localV = ingested.v;
        setCurrentV(localV);

        const dominant = localV.indexOf(Math.max(...localV));
        setRegister(['grounded', 'explorative', 'hedged', 'emphatic'][dominant]);

        // Build schema from conversation graph + accumulated surface
        const graph = buildConversationGraph([...turns, { role: 'user', text: userMessage }]);
        const graphCtx = composeContextFromGraph(graph, localV, uuid);
        const surfaceCtx = await composeContext(localDB, localV, uuid);
        schema = 'flowchart TD\n' + graphCtx + '\n' + surfaceCtx + '\n  classDef shadow fill:#333,color:#999,stroke:#555\n  classDef synapse fill:#1a1a2e,color:#c9a84c';

        const parsed = parseSchema(schema);
        const enrichedNodes = parsed.map((n) => {
          const weight = parseFloat(n.label.match(/w=([\d.]+)/)?.[1] || n.label.match(/x(\d+)/)?.[1] || "1");
          return { ...n, weight, prime_factors: factorsFromWeight(weight) };
        });
        if (enrichedNodes.length > 0) setNodes(enrichedNodes);
      }

      // Adaptive model tier
      let modelTier = 'sonnet';
      if (localDB) {
        try {
          const tx = localDB.transaction('word_coords', 'readonly');
          const count = await new Promise(r => {
            const req = tx.objectStore('word_coords').count();
            req.onsuccess = () => r(req.result);
            req.onerror = () => r(0);
          });
          if (count > 100) modelTier = 'haiku';
        } catch {}
      }

      // Step 2: Call LLM — schema from tiny kernel
      const chatRes = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          schema,
          history: turns.slice(-3).map((t) => ({
            role: t.role === "user" ? "user" : "assistant",
            text: t.text,
          })),
          model_tier: modelTier,
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

      // Parse tags before display or ingestion
      const { clean, imagines, programs: newProgs } = parseTags(modelResponse);

      // Step 3: Ingest CLEAN response — no tag pollution
      if (localDB && clean) {
        await ingest(clean, localDB, localTick, 'synapse');
        setLocalTick(prev => prev + 1);
      }

      // Add assistant turn — clean text, tags to renderers
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          text: clean,
          imagination: imagines,
          programs: newProgs,
          v: [...localV],
          register,
        },
      ]);

      // Accumulate programs for 3D rendering
      if (newProgs.length > 0) {
        setPrograms(prev => [...prev, ...newProgs]);
      }

      // Silent background sync
      if (localDB) {
        import('../../../lib/klein').then(({ getUnsynced, markSynced }) => {
          getUnsynced(localDB).then(unsynced => {
            if (unsynced.length === 0) return;
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uuid, entries: unsynced, sinceTick: localTick - 2 }),
            }).then(r => r.json()).then(result => {
              if (result.pushed > 0) markSynced(localDB, unsynced.map(e => e.tick));
            }).catch(() => {});
          });
        });
      }
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

          {/* Program nodes — hexagonal, positioned by address */}
          {programs.map((prog, i) => {
            const theta = ((prog.address || 1) * 137.508) % 360;
            const phi = ((prog.trace || 3) * 30) % 360;
            const skin_r = prog.valid ? 9.692 : 12.257;
            const visual = renderNode({ theta, phi, skin_r, weight: prog.address || 1, prime_factors: [], label: prog.name }, lens);
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
                {turn.programs && turn.programs.length > 0 && (
                  <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {turn.programs.map((p, j) => (
                      <span key={j} style={{
                        fontSize: 8, padding: "2px 6px", borderRadius: 8,
                        background: p.valid ? "#0a1a0a" : "#1a1a08",
                        color: p.valid ? "#4ade80" : "#d4a843",
                      }}>
                        ⬡ {p.name} {(p.operations || []).join('→')}
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

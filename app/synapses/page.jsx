'use client';

import { useState, useEffect, useRef } from 'react';
import { kernelWake, kernelTurn, parseSchema, PRIME_COLORS, vToColor } from '../../lib/kernel';
import { openTranslateDB, ingest, composeContext } from '../../lib/translate';
import LoginGate from './login';
import TeamsPanel from './teams';

const PRIME_LABELS = ['2', '3', '5', '7'];
const PRIME_BAR_COLORS = ['#e84040', '#40a8e8', '#d4a843', '#40d890'];

// Subgraph color mapping for landscape nodes
const SUBGRAPH_COLORS = {
  'Senses': '#e84040',
  'Memory': '#40a8e8',
  'Reason': '#d4a843',
  'Voice': '#40d890',
  'Shadow': '#b060d0',
};

function subgraphColor(subgraph) {
  if (!subgraph) return '#555';
  for (const [key, color] of Object.entries(SUBGRAPH_COLORS)) {
    if (subgraph.toLowerCase().includes(key.toLowerCase())) return color;
  }
  return '#c9a84c';
}

export default function SynapsesPage() {
  const [uuid, setUuid] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [schema, setSchema] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [turns, setTurns] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentV, setCurrentV] = useState([0.25, 0.25, 0.25, 0.25]);
  const [register, setRegister] = useState('grounded');
  const [tension, setTension] = useState(0);
  const [concepts, setConcepts] = useState([]);
  const [localDB, setLocalDB] = useState(null);
  const [localTick, setLocalTick] = useState(0);
  const conversationEnd = useRef(null);

  // Check auth on mount
  useEffect(() => {
    // Check localStorage first (fast)
    const stored = localStorage.getItem('torus_uuid');
    if (stored) {
      setUuid(stored);
      setAuthChecked(true);
      return;
    }
    // Then check cookie via API
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.authenticated && data.uuid) {
          setUuid(data.uuid);
          localStorage.setItem('torus_uuid', data.uuid);
        }
        setAuthChecked(true);
      })
      .catch(() => setAuthChecked(true));
  }, []);

  // Open local Klein bottle DB once authenticated
  useEffect(() => {
    if (!uuid) return;
    openTranslateDB()
      .then((db) => setLocalDB(db))
      .catch((err) => console.error('[klein] DB open failed:', err));
  }, [uuid]);

  // Wake the kernel once authenticated
  useEffect(() => {
    if (!uuid) return;
    kernelWake(uuid)
      .then((data) => {
        setSchema(data);
        if (data.schema) {
          const parsed = parseSchema(data.schema);
          setNodes(parsed);
        }
        if (data.v) setCurrentV(data.v);
        if (data.register) setRegister(data.register);
      })
      .catch((err) => {
        setError(`Kernel unreachable: ${err.message}`);
      });
  }, [uuid]);

  // Auto-scroll conversation
  useEffect(() => {
    conversationEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);
    setError(null);

    // Add user turn immediately
    setTurns((prev) => [...prev, { role: 'user', text: userMessage }]);

    try {
      // Step 0: Decompose into local Klein bottle — BEFORE anything else
      // This classifies every word, assigns prime addresses, stores on surface
      let localV = currentV;
      let localContext = '';
      if (localDB) {
        const ingested = await ingest(userMessage, localDB, localTick, 'user');
        setLocalTick(prev => prev + 1);
        localV = ingested.v;
        localContext = await composeContext(localDB, ingested.v, uuid);
      }

      // Step 1: Tell the kernel about the user message (async state update)
      // This updates flywheels, lattice, V(t), gears — returns enriched schema
      const kernelState = await kernelTurn(uuid, userMessage);

      // Extract kernel state — local Klein surface nests inside kernel schema
      const kernelSchema = kernelState?.schema || schema?.schema || '';
      let currentSchema = kernelSchema;
      if (localContext) {
        // Insert local subgraph before classDef/style lines (end of schema)
        const classDefIdx = kernelSchema.indexOf('  classDef');
        if (classDefIdx > 0) {
          currentSchema = kernelSchema.slice(0, classDefIdx)
            + localContext + '\n'
            + '  KLEIN_' + uuid.slice(0, 8) + ' -->|feeds| VOICE\n'
            + kernelSchema.slice(classDefIdx);
        } else {
          // No classDef — append with edge to VOICE if it exists
          currentSchema = kernelSchema + '\n' + localContext
            + (kernelSchema.includes('VOICE') ? '\n  KLEIN_' + uuid.slice(0, 8) + ' -->|feeds| VOICE' : '');
        }
      }
      const gearNotes = (kernelState?.gear_contributions || []).map(g => g.note);
      const v = kernelState?.v || kernelState?.voice_state?.v || currentV;
      const reg = kernelState?.register || kernelState?.voice_state?.register || register;
      const tens = kernelState?.tension ?? kernelState?.voice_state?.tension ?? tension;

      setCurrentV(v);
      setRegister(reg);
      setTension(tens);

      if (kernelState?.schema) {
        const parsed = parseSchema(typeof kernelState.schema === 'string' ? kernelState.schema : '');
        if (parsed.length > 0) setNodes(parsed);
      }

      // Step 2: Call the LLM with the schema as system prompt
      // The schema IS the context. Computed by the kernel. Served to the model.
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          schema: currentSchema,
          history: turns.map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', text: t.text })),
          model_tier: 'sonnet',
          uuid,
          gear_notes: gearNotes,
        }),
      });

      const chatData = await chatResponse.json();

      if (chatData.error) {
        setError(`LLM error: ${chatData.error}`);
        setLoading(false);
        return;
      }

      const modelResponse = chatData.response || '';

      // Step 2.5: Ingest model response into local surface too
      // The AI's words grow the same Klein bottle — tagged as synapse voice
      if (localDB && modelResponse) {
        await ingest(modelResponse, localDB, localTick, 'synapse');
        setLocalTick(prev => prev + 1);
      }

      // Step 3: Tell the kernel about the model's response (async enrichment)
      // This parses <imagine> tags, enriches schema, updates surfaces
      const enrichment = await kernelTurn(uuid, null, modelResponse);

      // Extract post-enrichment state
      const postV = enrichment?.v || enrichment?.voice?.v || v;
      const postReg = enrichment?.register || enrichment?.voice?.register || reg;
      const imagination = enrichment?.imagination?.spawned || [];
      const responseConcepts = enrichment?.concepts || [];

      setCurrentV(postV);
      setRegister(postReg);

      if (enrichment?.schema) {
        const parsed = parseSchema(typeof enrichment.schema === 'string' ? enrichment.schema : '');
        if (parsed.length > 0) setNodes(parsed);
      }

      // Extract programs from enrichment
      const programs = enrichment?.programs?.defined || [];

      // Add assistant turn
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: modelResponse,
          v: [...postV],
          register: postReg,
          tension: tens,
          concepts: responseConcepts,
          imagination,
          programs,
          model: chatData.model,
          tokens: chatData.usage,
        },
      ]);

      // Store conversation locally
      try {
        const convKey = `torus_conv_${uuid}_active`;
        const stored = JSON.parse(localStorage.getItem(convKey) || '[]');
        stored.push({ role: 'user', text: userMessage, ts: Date.now() });
        stored.push({ role: 'assistant', text: modelResponse, v: postV, ts: Date.now() });
        localStorage.setItem(convKey, JSON.stringify(stored.slice(-100))); // keep last 100 turns
      } catch {} // localStorage might be full

    } catch (err) {
      setError(`Turn failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Position nodes in a circular layout
  function nodePositions(nodeList) {
    const n = nodeList.length;
    if (n === 0) return [];
    const cx = 50, cy = 50, radius = 38;
    return nodeList.map((node, i) => {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      return {
        ...node,
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    });
  }

  const positioned = nodePositions(nodes);

  // Auth gate
  if (!authChecked) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#050510', color: '#555', fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
      }}>
        ...
      </div>
    );
  }

  if (!uuid) {
    return <LoginGate onAuth={(id) => { setUuid(id); }} />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      paddingTop: 50,
      boxSizing: 'border-box',
      background: '#050510',
      color: '#e8d5a3',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
      overflow: 'hidden',
    }}>

      {/* Teams Panel */}
      <TeamsPanel uuid={uuid} />

      {/* Torus Landscape */}
      <div style={{
        flex: 1,
        position: 'relative',
        borderBottom: '1px solid #1a1a2e',
        minHeight: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 10,
          color: '#555',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          Torus Landscape
        </div>

        {positioned.length === 0 && !error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#333',
            fontSize: 11,
          }}>
            Awaiting kernel schema...
          </div>
        )}

        {positioned.map((node) => (
          <div
            key={node.id}
            title={`${node.label}${node.subgraph ? ` (${node.subgraph})` : ''}`}
            style={{
              position: 'absolute',
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: 'translate(-50%, -50%)',
              background: node.isShadow ? '#1a1028' : '#0c0c18',
              border: `1px solid ${subgraphColor(node.subgraph)}`,
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 10,
              color: subgraphColor(node.subgraph),
              whiteSpace: 'nowrap',
              opacity: node.isShadow ? 0.5 : 0.9,
              boxShadow: `0 0 8px ${subgraphColor(node.subgraph)}22`,
              cursor: 'default',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {node.label}
          </div>
        ))}

        {error && (
          <div style={{
            position: 'absolute',
            bottom: 8,
            left: 12,
            right: 12,
            color: '#e84040',
            fontSize: 10,
            background: '#1a0808',
            padding: '4px 8px',
            borderRadius: 3,
            border: '1px solid #e8404033',
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Voice Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 12px',
        height: 36,
        boxSizing: 'border-box',
        borderBottom: '1px solid #1a1a2e',
        background: '#080812',
        flexShrink: 0,
      }}>
        {/* V(t) color segments */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: '#555', marginRight: 4 }}>V(t)</span>
          {currentV.map((val, i) => (
            <div
              key={i}
              title={`prime ${PRIME_LABELS[i]}: ${(val * 100).toFixed(1)}%`}
              style={{
                width: Math.max(8, val * 80),
                height: 12,
                background: PRIME_BAR_COLORS[i],
                opacity: 0.3 + val * 0.7,
                borderRadius: 2,
                transition: 'width 0.3s ease, opacity 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Blended color dot */}
        <div style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: vToColor(currentV),
          boxShadow: `0 0 6px ${vToColor(currentV)}`,
          flexShrink: 0,
        }} />

        {/* Register */}
        <span style={{
          fontSize: 10,
          color: '#c9a84c',
          letterSpacing: 1,
          textTransform: 'uppercase',
        }}>
          {register}
        </span>

        {/* Tension */}
        <span style={{
          fontSize: 10,
          color: tension > 0.6 ? '#e84040' : tension > 0.3 ? '#d4a843' : '#40d890',
          marginLeft: 'auto',
        }}>
          tension: {(tension * 100).toFixed(0)}%
        </span>

        {/* Concepts */}
        {concepts.length > 0 && (
          <div style={{ display: 'flex', gap: 4 }}>
            {concepts.slice(0, 5).map((c, i) => (
              <span key={i} style={{
                fontSize: 9,
                color: '#888',
                background: '#0e0e18',
                padding: '1px 5px',
                borderRadius: 3,
                border: '1px solid #1a1a2e',
              }}>
                {typeof c === 'string' ? c : c.label || c.name || JSON.stringify(c)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Conversation */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: 300,
        height: '40%',
        minHeight: 0,
        borderTop: '1px solid #1a1a2e',
      }}>
        {/* Turn history */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
        }}>
          {turns.length === 0 && (
            <div style={{ color: '#333', fontSize: 11, padding: '12px 0' }}>
              Type a message to begin a conversation with the kernel.
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} style={{
              marginBottom: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 9,
                  color: turn.role === 'user' ? '#40a8e8' : '#c9a84c',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  fontWeight: 600,
                }}>
                  {turn.role === 'user' ? 'You' : 'Kernel'}
                </span>

                {turn.v && (
                  <div style={{ display: 'flex', gap: 1 }}>
                    {turn.v.map((val, j) => (
                      <div key={j} style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: PRIME_BAR_COLORS[j],
                        opacity: 0.3 + val * 0.7,
                      }} />
                    ))}
                  </div>
                )}

                {turn.register && (
                  <span style={{ fontSize: 9, color: '#555' }}>
                    [{turn.register}]
                  </span>
                )}
              </div>

              <div style={{
                color: turn.role === 'user' ? '#aaa' : '#e8d5a3',
                lineHeight: 1.5,
                paddingLeft: 4,
                whiteSpace: 'pre-wrap',
              }}>
                {turn.text || '(no response)'}
              </div>

              {/* Imagination spheres */}
              {turn.imagination && turn.imagination.length > 0 && (
                <div style={{
                  display: 'flex', gap: 6, paddingLeft: 4, marginTop: 4, flexWrap: 'wrap',
                }}>
                  {turn.imagination.map((sphere, si) => (
                    <div key={si} style={{
                      fontSize: 9, color: '#b060d0', background: '#14081c',
                      border: '1px solid #b060d033', borderRadius: 12, padding: '2px 8px',
                    }}>
                      {typeof sphere === 'string' ? sphere : sphere.label || JSON.stringify(sphere)}
                    </div>
                  ))}
                </div>
              )}

              {/* Programs */}
              {turn.programs && turn.programs.length > 0 && (
                <div style={{
                  display: 'flex', gap: 6, paddingLeft: 4, marginTop: 4, flexWrap: 'wrap',
                }}>
                  {turn.programs.map((prog, pi) => (
                    <div key={pi} style={{
                      fontSize: 9, padding: '2px 8px', borderRadius: 12,
                      background: prog.valid ? '#0a1a0a' : '#1a1a08',
                      border: `1px solid ${prog.valid ? '#4ade8033' : '#d4a84333'}`,
                      color: prog.valid ? '#4ade80' : '#d4a843',
                    }}>
                      {prog.name} {prog.operations?.join(' \u2192 ')} addr={prog.address}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={conversationEnd} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          gap: 8,
          padding: '8px 12px',
          borderTop: '1px solid #1a1a2e',
          background: '#080812',
          flexShrink: 0,
        }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={loading ? 'Thinking...' : 'Speak to the kernel...'}
            disabled={loading}
            style={{
              flex: 1,
              background: '#0e0e14',
              border: '1px solid #1a1a2e',
              borderRadius: 3,
              padding: '6px 10px',
              color: '#e8d5a3',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            style={{
              background: loading ? '#1a1a2e' : '#c9a84c',
              color: loading ? '#555' : '#050510',
              border: 'none',
              borderRadius: 3,
              padding: '6px 14px',
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              cursor: loading ? 'default' : 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  );
}

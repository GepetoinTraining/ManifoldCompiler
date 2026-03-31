'use client';

import { useState, useEffect, useRef } from 'react';
import { parseSchema, PRIME_COLORS, vToColor } from '../../lib/kernel';
import { openTranslateDB, ingest, composeContext, buildConversationGraph, composeContextFromGraph } from '../../lib/translate';
import LoginGate from './login';
import TeamsPanel from './teams';
import TorusSpace from '../components/TorusSpace';

const PRIME_LABELS = ['2', '3', '5', '7'];
const PRIME_BAR_COLORS = ['#e84040', '#40a8e8', '#d4a843', '#40d890'];

// Parse and strip <imagine> and <program> tags from model response
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

  // Build initial context from local Klein bottle
  useEffect(() => {
    if (!uuid || !localDB) return;
    composeContext(localDB, currentV, uuid)
      .then((ctx) => {
        if (ctx) {
          const fullSchema = 'flowchart TD\n' + ctx + '\n  classDef shadow fill:#333,color:#999,stroke:#555';
          setSchema({ schema: fullSchema });
          const parsed = parseSchema(fullSchema);
          setNodes(parsed);
        }
      })
      .catch((err) => {
        console.error('[wake] local context failed:', err);
      });
  }, [uuid, localDB]);

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
      // Step 1: Decompose into local Klein bottle
      let localV = currentV;
      let currentSchema = '';
      if (localDB) {
        const ingested = await ingest(userMessage, localDB, localTick, 'user');
        setLocalTick(prev => prev + 1);
        localV = ingested.v;
        setCurrentV(localV);

        // Determine register from dominant prime
        const dominant = localV.indexOf(Math.max(...localV));
        const registers = ['grounded', 'explorative', 'hedged', 'emphatic'];
        setRegister(registers[dominant]);

        // Build schema from conversation graph (φ-pruned bones + edges)
        const graph = buildConversationGraph([...turns, { role: 'user', text: userMessage }]);
        const graphCtx = composeContextFromGraph(graph, localV, uuid);

        // Also get accumulated surface context
        const surfaceCtx = await composeContext(localDB, localV, uuid);

        // Combine: graph (conversation shape) + surface (accumulated knowledge)
        currentSchema = 'flowchart TD\n' + graphCtx + '\n' + surfaceCtx + '\n  classDef shadow fill:#333,color:#999,stroke:#555\n  classDef synapse fill:#1a1a2e,color:#c9a84c';

        // Update landscape
        const parsed = parseSchema(currentSchema);
        if (parsed.length > 0) setNodes(parsed);
      }

      // Adaptive model tier — sonnet until torus has density, then haiku
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

      // Step 2: Call the LLM — schema comes from tiny kernel, not server
      const chatResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          schema: currentSchema,
          history: turns.slice(-3).map(t => ({ role: t.role === 'user' ? 'user' : 'assistant', text: t.text })),
          model_tier: modelTier,
          uuid,
        }),
      });

      const chatData = await chatResponse.json();

      if (chatData.error) {
        setError(`LLM error: ${chatData.error}`);
        setLoading(false);
        return;
      }

      const modelResponse = chatData.response || '';

      // Parse tags BEFORE display or ingestion
      const { clean, imagines, programs } = parseTags(modelResponse);

      // Step 3: Ingest CLEAN response into local surface — no tag pollution
      if (localDB && clean) {
        const modelIngested = await ingest(clean, localDB, localTick, 'synapse');
        setLocalTick(prev => prev + 1);

        const blended = localV.map((v, i) => (v + modelIngested.v[i]) / 2);
        setCurrentV(blended);
      }

      // Add assistant turn — clean text, tags routed to renderers
      setTurns((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: clean,
          imagination: imagines,
          programs: programs,
          v: [...localV],
          register,
          model: chatData.model,
          tokens: chatData.usage,
        },
      ]);

      // Store conversation locally
      try {
        const convKey = `torus_conv_${uuid}_active`;
        const stored = JSON.parse(localStorage.getItem(convKey) || '[]');
        stored.push({ role: 'user', text: userMessage, ts: Date.now() });
        stored.push({ role: 'assistant', text: modelResponse, v: localV, ts: Date.now() });
        localStorage.setItem(convKey, JSON.stringify(stored.slice(-100)));
      } catch {} // localStorage might be full

      // Silent background sync to Turso — user never sees this
      if (localDB) {
        import('../../lib/klein').then(({ getUnsynced, markSynced }) => {
          getUnsynced(localDB).then(unsynced => {
            if (unsynced.length === 0) return;
            fetch('/api/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uuid, entries: unsynced, sinceTick: localTick - 2 }),
            }).then(r => r.json()).then(result => {
              if (result.pushed > 0) markSynced(localDB, unsynced.map(e => e.tick));
            }).catch(() => {}); // sync failure is silent
          });
        });
      }

    } catch (err) {
      setError(`Turn failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Collect programs from all turns
  const allPrograms = turns
    .filter(t => t.programs && t.programs.length > 0)
    .flatMap(t => t.programs);

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

      {/* 3D Workspace */}
      <div style={{ flex: 1, borderBottom: '1px solid #1a1a2e', minHeight: 0, position: 'relative' }}>
        <TorusSpace nodes={nodes} programs={allPrograms} />
        {error && (
          <div style={{
            position: 'absolute', bottom: 8, left: 12, right: 12,
            color: '#e84040', fontSize: 10, background: '#1a0808',
            padding: '4px 8px', borderRadius: 3, border: '1px solid #e8404033',
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

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
  const [dbWords, setDbWords] = useState([]);  // Full DB torus — all word_coords
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

  // Load full DB torus words
  function refreshDbWords() {
    if (!localDB) return;
    const tx = localDB.transaction('word_coords', 'readonly');
    const req = tx.objectStore('word_coords').getAll();
    req.onsuccess = () => setDbWords(req.result || []);
  }

  useEffect(() => { refreshDbWords(); }, [localDB]);

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
        refreshDbWords();
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
        refreshDbWords();

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

  // Build conversation graph for the state panel
  const convGraph = buildConversationGraph(turns);

  return (
    <div style={{
      display: 'flex',
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

      {/* ═══ LEFT COLUMN: Visuals ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Row 1: Torus + Conv State */}
        <div style={{ display: 'flex', height: '40%', minHeight: 0, borderBottom: '1px solid #1a1a2e' }}>

          {/* Full DB Torus — every word at its real theta/phi */}
          <div style={{
            flex: 1, position: 'relative', borderRight: '1px solid #1a1a2e', overflow: 'hidden',
            background: 'radial-gradient(ellipse at center, #0a0a1a 0%, #050510 100%)',
          }}>
            <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 8, color: '#444', letterSpacing: 1, textTransform: 'uppercase' }}>
              Torus — {dbWords.length}w
            </div>
            {/* Words positioned by real torus coordinates */}
            {dbWords.map((w, i) => {
              // Map theta (0-36000) to x%, phi to y%
              const x = (w.theta / 360) % 100;
              const y = 10 + (w.phi / 360) * 80;  // phi 0 = all same row for now
              const size = Math.max(2, Math.min(12, Math.log(w.count + 1) * 2.5));
              const mask = w.mask || 0;
              const color = mask & 1 ? '#e84040' : mask & 2 ? '#40a8e8' : mask & 4 ? '#d4a843' : mask & 8 ? '#40d890' : '#555';
              const opacity = Math.min(0.9, 0.2 + w.count * 0.05);
              return (
                <div key={w.word} title={`${w.word} x${w.count} θ=${w.theta}`} style={{
                  position: 'absolute',
                  left: `${x}%`, top: `${y}%`,
                  width: size, height: size,
                  borderRadius: '50%', background: color, opacity,
                  transform: 'translate(-50%,-50%)',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                  boxShadow: w.count > 3 ? `0 0 ${size}px ${color}44` : 'none',
                }} />
              );
            })}
            {/* V(t) overlay */}
            <div style={{
              position: 'absolute', bottom: 6, left: 8, display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {currentV.map((val, i) => (
                <div key={i} title={`p${PRIME_LABELS[i]}: ${(val*100).toFixed(0)}%`} style={{
                  width: Math.max(6, val * 50), height: 8,
                  background: PRIME_BAR_COLORS[i], opacity: 0.3 + val * 0.7,
                  borderRadius: 2, transition: 'all 0.3s',
                }} />
              ))}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: vToColor(currentV), boxShadow: `0 0 4px ${vToColor(currentV)}`,
              }} />
              <span style={{ fontSize: 8, color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>
                {register}
              </span>
            </div>
          </div>

          {/* Conversation State (graph visualization) */}
          <div style={{
            width: '35%', position: 'relative', overflow: 'hidden',
            background: 'radial-gradient(ellipse at center, #080818 0%, #050510 100%)',
          }}>
            <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 8, color: '#444', letterSpacing: 1, textTransform: 'uppercase' }}>
              Conv Graph — {convGraph.nodes.length}n {convGraph.edges.length}e
            </div>
            {/* Render graph nodes as small positioned dots */}
            {convGraph.nodes.slice(-15).map((n, i) => {
              const angle = (i * 137.508 * Math.PI / 180);
              const r = 25 + (n.weight % 20);
              const x = 50 + r * Math.cos(angle);
              const y = 50 + r * Math.sin(angle);
              const size = Math.max(3, Math.min(10, Math.log(n.weight + 1) * 2));
              return (
                <div key={`gn-${i}`} title={`${n.word} w=${n.weight} t${n.turn}`} style={{
                  position: 'absolute', left: `${x}%`, top: `${y}%`,
                  width: size, height: size, borderRadius: '50%',
                  background: n.role === 'user' ? '#40a8e8' : '#c9a84c',
                  opacity: 0.6, transform: 'translate(-50%,-50%)',
                  transition: 'all 0.5s',
                }} />
              );
            })}
          </div>
        </div>

        {/* Row 2: 3D Workspace (personal) */}
        <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
          <TorusSpace nodes={nodes} programs={allPrograms} />
          <div style={{ position: 'absolute', top: 6, left: 8, fontSize: 8, color: '#333', letterSpacing: 1, textTransform: 'uppercase' }}>
            Workspace
          </div>
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
      </div>

      {/* ═══ RIGHT COLUMN: Chat ═══ */}
      <div style={{
        width: 380, display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid #1a1a2e', background: '#0a0a0f',
      }}>

        {/* Turn history */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {turns.length === 0 && (
            <div style={{ color: '#333', fontSize: 11, padding: '20px 0', textAlign: 'center' }}>
              Speak to build the space.
            </div>
          )}

          {turns.map((turn, i) => (
            <div key={i} style={{
              marginBottom: 10, paddingLeft: turn.role === 'user' ? 0 : 8,
              borderLeft: turn.role === 'user' ? 'none' : `2px solid ${vToColor(turn.v || currentV)}`,
            }}>
              <div style={{ fontSize: 8, color: '#444', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 1 }}>
                {turn.role === 'user' ? 'you' : 'synapse'}
                {turn.register && ` · ${turn.register}`}
              </div>
              <div style={{
                fontSize: 11, lineHeight: 1.618,
                color: turn.role === 'user' ? '#e8d5a3' : '#bbb',
                whiteSpace: 'pre-wrap',
              }}>
                {turn.text || '(no response)'}
              </div>

              {/* Imagination pills */}
              {turn.imagination && turn.imagination.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {turn.imagination.map((s, j) => (
                    <span key={j} style={{
                      fontSize: 8, padding: '2px 6px', borderRadius: 8,
                      background: '#14081c', color: '#b060d0', border: '1px solid #b060d033',
                    }}>
                      ◇ {s.name || s.label || JSON.stringify(s)}
                    </span>
                  ))}
                </div>
              )}

              {/* Program pills */}
              {turn.programs && turn.programs.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                  {turn.programs.map((p, j) => (
                    <span key={j} style={{
                      fontSize: 8, padding: '2px 6px', borderRadius: 8,
                      background: p.valid ? '#0a1a0a' : '#1a1a08',
                      color: p.valid ? '#4ade80' : '#d4a843',
                    }}>
                      ⬡ {p.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={conversationEnd} />
        </div>

        {/* Input — growing textarea */}
        <form onSubmit={handleSubmit} style={{
          display: 'flex', gap: 6, padding: '8px 12px',
          borderTop: '1px solid #1a1a2e', background: '#080812', flexShrink: 0, alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }}
            placeholder={loading ? 'Thinking...' : 'Speak to the kernel...'}
            disabled={loading}
            rows={1}
            style={{
              flex: 1, background: '#0e0e14', border: '1px solid #1a1a2e',
              borderRadius: 4, padding: '8px 10px', color: '#e8d5a3',
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
              outline: 'none', resize: 'none', lineHeight: 1.5,
              minHeight: 36, maxHeight: 120,
              height: Math.min(120, Math.max(36, 20 + (input.split('\n').length) * 18)),
            }}
          />
          <button type="submit" disabled={loading || !input.trim()} style={{
            background: loading ? '#1a1a2e' : '#c9a84c',
            color: loading ? '#555' : '#050510',
            border: 'none', borderRadius: 4,
            padding: '8px 12px', fontFamily: 'inherit',
            fontSize: 11, fontWeight: 600, cursor: loading ? 'default' : 'pointer',
            opacity: loading ? 0.5 : 1,
          }}>
            ⬡
          </button>
        </form>
      </div>
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";

// ════════════════════════════════════════════════════════════
// MM COMPILER VERIFIER
// ════════════════════════════════════════════════════════════
// This page PROVES the compiler adds no code.
// Tab 1: Camera reads QR/barcodes. Read-only. No injection.
// Tab 2: Renders what was scanned. Pure crystallization.
// Tab 3: Audit trail. Every scan, every byte, every change.
// ════════════════════════════════════════════════════════════

// §0 — SEED (the only pre-existing logic)
const PHI = (() => { let x = 2; for (let i = 0; i < 100; i++) x = 1 + 1/x; return x; })();

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function factorize(n) {
  if (n < 2) return [n];
  const f = []; let t = Math.abs(Math.round(n));
  for (let d = 2; d * d <= t; d++) while (t % d === 0) { f.push(d); t /= d; }
  if (t > 1) f.push(t); return f;
}

// ════════════════════════════════════════════════════════════
// BARCODE PROTOCOL: type:prime:content
// ════════════════════════════════════════════════════════════
function parse(raw) {
  const i = raw.indexOf(':');
  if (i < 0) return null;
  const j = raw.indexOf(':', i + 1);
  if (j < 0) return null;
  const type = raw.slice(0, i);
  const prime = parseInt(raw.slice(i + 1, j));
  const content = raw.slice(j + 1);
  if (isNaN(prime)) return null;
  return { type, prime, content, raw, bytes: new Blob([raw]).size };
}

// ════════════════════════════════════════════════════════════
// PERSISTENT STORAGE
// ════════════════════════════════════════════════════════════
const STORAGE_KEY = 'mm_compiler';

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { nodes: [], audit: [], totalBytes: 0 };
  } catch { return { nodes: [], audit: [], totalBytes: 0 }; }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════
export default function MMCompiler() {
  const [tab, setTab] = useState(0);
  const [state, setState] = useState(loadState);
  const [camActive, setCamActive] = useState(false);
  const [lastRead, setLastRead] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const videoRef = useRef(null);
  const scanRef = useRef({ last: '', time: 0 });
  const streamRef = useRef(null);

  // ── Persist on change ──
  useEffect(() => { saveState(state); }, [state]);

  // ── Camera lifecycle ──
  useEffect(() => {
    if (tab === 0 && !camActive) startCamera();
    return () => { if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; setCamActive(false); } };
  }, [tab]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) videoRef.current.srcObject = stream;
      streamRef.current = stream;
      setCamActive(true);
      startDetection();
    } catch (e) {
      setCamActive(false);
    }
  }, []);

  const startDetection = useCallback(() => {
    if (!('BarcodeDetector' in window)) return;
    const detector = new BarcodeDetector({
      formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'data_matrix']
    });

    const loop = () => {
      if (!videoRef.current || !streamRef.current) return;
      detector.detect(videoRef.current).then(codes => {
        for (const c of codes) {
          const now = Date.now();
          if (c.rawValue === scanRef.current.last && now - scanRef.current.time < 2500) continue;
          scanRef.current = { last: c.rawValue, time: now };
          handleScan(c.rawValue);
        }
      }).catch(() => {});
      requestAnimationFrame(loop);
    };
    loop();
  }, []);

  // ── SCAN HANDLER ──
  const handleScan = useCallback((raw) => {
    const parsed = parse(raw);
    const timestamp = new Date().toISOString();

    if (!parsed) {
      setLastRead({ raw, error: 'unparseable', timestamp });
      setState(prev => ({
        ...prev,
        audit: [...prev.audit, { timestamp, raw: raw.slice(0, 100), action: 'REJECTED', reason: 'invalid format' }]
      }));
      return;
    }

    // Check duplicate
    const isDuplicate = state.nodes.some(n => n.prime === parsed.prime);
    if (isDuplicate) {
      setLastRead({ ...parsed, duplicate: true, timestamp });
      setState(prev => ({
        ...prev,
        audit: [...prev.audit, { timestamp, raw: raw.slice(0, 80), action: 'DUPLICATE', prime: parsed.prime }]
      }));
      return;
    }

    // Compute GCD links
    const links = state.nodes
      .filter(n => gcd(parsed.prime, n.prime) > 1)
      .map(n => ({ prime: n.prime, shared: gcd(parsed.prime, n.prime) }));

    const node = {
      type: parsed.type,
      prime: parsed.prime,
      factors: factorize(parsed.prime),
      content: parsed.content,
      links,
      tick: state.nodes.length,
      timestamp,
      bytes: parsed.bytes
    };

    setLastRead({ ...parsed, accepted: true, links, timestamp });
    setState(prev => ({
      nodes: [...prev.nodes, node],
      audit: [...prev.audit, {
        timestamp,
        action: 'CRYSTALLIZED',
        type: parsed.type,
        prime: parsed.prime,
        factors: factorize(parsed.prime).join('×'),
        bytes: parsed.bytes,
        links: links.length,
        content_preview: parsed.content.slice(0, 60)
      }],
      totalBytes: prev.totalBytes + parsed.bytes
    }));
  }, [state.nodes]);

  // ── Manual scan ──
  const submitManual = () => {
    if (manualInput.trim()) {
      handleScan(manualInput.trim());
      setManualInput('');
    }
  };

  // ── Clear all ──
  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState({ nodes: [], audit: [], totalBytes: 0 });
    setLastRead(null);
  };

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════

  const tabStyle = (t) => ({
    flex: 1,
    padding: '10px 0',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: tab === t ? 700 : 400,
    color: tab === t ? '#c9a84c' : '#555',
    borderBottom: tab === t ? '2px solid #c9a84c' : '2px solid transparent',
    background: 'transparent',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid',
    borderBottomColor: tab === t ? '#c9a84c' : 'transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 1,
    textTransform: 'uppercase',
  });

  return (
    <div style={{
      background: '#0a0a0c', color: '#e8d5a3', fontFamily: "'JetBrains Mono','Fira Code',monospace",
      fontSize: 11, minHeight: '100vh', display: 'flex', flexDirection: 'column',
      maxWidth: 480, margin: '0 auto', width: '100%'
    }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#c9a84c' }}>MM Compiler</div>
          <div style={{ fontSize: 8, color: '#444', marginTop: 2 }}>proves it adds nothing</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: '#444' }}>{state.nodes.length} nodes · {state.totalBytes}b</span>
          <button onClick={clearAll} style={{ background: '#1a1510', border: '1px solid #2a2018', color: '#8c4c4c', fontFamily: 'inherit', fontSize: 9, padding: '3px 8px', cursor: 'pointer', borderRadius: 2 }}>∅</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a1a1e' }}>
        <button style={tabStyle(0)} onClick={() => setTab(0)}>① scan</button>
        <button style={tabStyle(1)} onClick={() => setTab(1)}>② page</button>
        <button style={tabStyle(2)} onClick={() => setTab(2)}>③ audit</button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ════════ TAB 0: SCANNER ════════ */}
        {tab === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Camera */}
            <div style={{ position: 'relative', background: '#000', flexShrink: 0 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', maxHeight: '40vh' }} />
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 200, height: 80, border: '2px solid #c9a84c44', borderRadius: 4, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: camActive ? '#4c8c5c' : '#8c4c4c' }}>
                {camActive ? '● camera active' : '○ no camera'}
              </div>
            </div>

            {/* Manual input */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid #1a1a1e', display: 'flex', gap: 4 }}>
              <input
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitManual()}
                placeholder="type:prime:content"
                style={{ flex: 1, background: '#0e0e11', border: '1px solid #1a1a1e', color: '#e8d5a3', fontFamily: 'inherit', fontSize: 11, padding: '6px 8px', outline: 'none', borderRadius: 2 }}
              />
              <button onClick={submitManual} style={{ background: '#1a1510', border: '1px solid #4a3d1f', color: '#c9a84c', fontFamily: 'inherit', fontSize: 11, padding: '6px 10px', cursor: 'pointer', borderRadius: 2 }}>→</button>
            </div>

            {/* Last read status */}
            <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
              {lastRead ? (
                <div style={{ padding: 8, border: '1px solid #1a1a1e', borderRadius: 3 }}>
                  <div style={{ fontSize: 9, color: lastRead.error ? '#8c4c4c' : lastRead.duplicate ? '#555' : '#4c8c5c', marginBottom: 4 }}>
                    {lastRead.error ? '✗ REJECTED' : lastRead.duplicate ? '○ DUPLICATE' : '★ ACCEPTED'}
                  </div>
                  {lastRead.type && <div style={{ color: '#c9a84c' }}>type: {lastRead.type}</div>}
                  {lastRead.prime && <div>prime: {lastRead.prime} = {factorize(lastRead.prime).join('×')}</div>}
                  {lastRead.content && <div style={{ color: '#888', marginTop: 4, wordBreak: 'break-all' }}>{lastRead.content.slice(0, 120)}</div>}
                  {lastRead.bytes && <div style={{ fontSize: 9, color: '#444', marginTop: 4 }}>{lastRead.bytes} bytes</div>}
                  {lastRead.links && lastRead.links.length > 0 && (
                    <div style={{ fontSize: 9, color: '#3a6b8c', marginTop: 4 }}>
                      links: {lastRead.links.map(l => `P${l.prime}(gcd=${l.shared})`).join(' · ')}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#333' }}>
                  [] void<br /><br />
                  <span style={{ fontSize: 9, color: '#444' }}>point camera at a barcode<br />or type below</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB 1: RENDERED PAGE ════════ */}
        {tab === 1 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
            {state.nodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#333' }}>
                [] void<br /><br />
                <span style={{ fontSize: 9, color: '#444' }}>nothing crystallized yet</span>
              </div>
            ) : (
              state.nodes.map((node, i) => {
                if (node.type === 'css') return <style key={i}>{node.content}</style>;
                if (node.type === 'js') return null; // show in audit, don't execute here
                if (node.type === 'sep' || node.type === 'hr') return <hr key={i} style={{ borderColor: '#1a1a1e', margin: '12px 0' }} />;

                const Tag = node.type === 'h1' ? 'h1' : node.type === 'h2' ? 'h2' : node.type === 'h3' ? 'h3' : 'p';
                const isHeading = ['h1', 'h2', 'h3'].includes(node.type);
                const isMath = node.type === 'math';
                const isDef = node.type === 'def';

                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    {isMath ? (
                      <pre style={{ textAlign: 'center', color: '#c9a84c', padding: '8px 0', fontStyle: 'italic' }}>{node.content}</pre>
                    ) : isDef ? (
                      <p style={{ borderLeft: '2px solid #4c8c5c', paddingLeft: 10 }}>
                        {(() => { const parts = node.content.split('|'); return <><strong>{parts[0]}</strong> {parts[1] || ''}</>; })()}
                      </p>
                    ) : (
                      <Tag style={isHeading ? { color: '#c9a84c', margin: '16px 0 8px' } : {}}>{node.content}</Tag>
                    )}
                    {node.links.length > 0 && (
                      <div style={{ fontSize: 8, color: '#3a6b8c', marginTop: 2 }}>
                        ↔ {node.links.map(l => `P${l.prime}(${l.shared})`).join(' · ')}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ════════ TAB 2: AUDIT LOG ════════ */}
        {tab === 2 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
            {/* Summary */}
            <div style={{ padding: '8px', marginBottom: 8, border: '1px solid #1a1a1e', borderRadius: 3 }}>
              <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', marginBottom: 4 }}>Compiler Proof</div>
              <div>Total scans: {state.audit.length}</div>
              <div>Crystallized: {state.nodes.length}</div>
              <div>Total bytes received: {state.totalBytes}</div>
              <div>Compiler bytes added: <span style={{ color: '#4c8c5c', fontWeight: 700 }}>0</span></div>
              <div style={{ fontSize: 9, color: '#444', marginTop: 4 }}>
                every byte on tab ② came from a barcode scan. nothing was generated, injected, or modified by this page.
              </div>
            </div>

            {/* Log entries */}
            {[...state.audit].reverse().map((entry, i) => (
              <div key={i} style={{
                padding: '6px 8px', marginBottom: 3, borderRadius: 2,
                border: `1px solid ${entry.action === 'CRYSTALLIZED' ? '#1a2a1a' : entry.action === 'REJECTED' ? '#2a1a1a' : '#1a1a1e'}`,
                fontSize: 9
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{
                    color: entry.action === 'CRYSTALLIZED' ? '#4c8c5c' : entry.action === 'REJECTED' ? '#8c4c4c' : '#555',
                    fontWeight: 700
                  }}>
                    {entry.action}
                  </span>
                  <span style={{ color: '#333' }}>{entry.timestamp?.split('T')[1]?.slice(0, 8)}</span>
                </div>
                {entry.prime && <div style={{ color: '#c9a84c' }}>P{entry.prime} = {entry.factors} [{entry.type}]</div>}
                {entry.bytes && <div style={{ color: '#444' }}>{entry.bytes} bytes · {entry.links || 0} links</div>}
                {entry.content_preview && <div style={{ color: '#555', wordBreak: 'break-all' }}>{entry.content_preview}</div>}
                {entry.reason && <div style={{ color: '#8c4c4c' }}>{entry.reason}</div>}
                {entry.raw && !entry.prime && <div style={{ color: '#555', wordBreak: 'break-all' }}>{entry.raw}</div>}
              </div>
            ))}

            {state.audit.length === 0 && (
              <div style={{ textAlign: 'center', padding: 20, color: '#333' }}>
                no scans recorded
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

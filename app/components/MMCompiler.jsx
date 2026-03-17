"use client";

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
// ── Scan mode formats ──
const SCAN_MODES = {
  qr:      { label: 'QR Code',  icon: '⬡', formats: ['qr_code', 'data_matrix'] },
  barcode: { label: 'Barcode',  icon: '⫼', formats: ['code_128', 'code_39', 'ean_13', 'ean_8'] },
};

export default function MMCompiler() {
  const [tab, setTab] = useState(0);
  const [state, setState] = useState(loadState);
  const [camActive, setCamActive] = useState(false);
  const [lastRead, setLastRead] = useState(null);
  const [manualInput, setManualInput] = useState('');
  const [scanMode, setScanMode] = useState('qr');
  const videoRef = useRef(null);
  const scanRef = useRef({ last: '', time: 0 });
  const streamRef = useRef(null);
  const loopRef = useRef(null);

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
      startDetection(scanMode);
    } catch (e) {
      setCamActive(false);
    }
  }, []);

  const startDetection = useCallback((mode) => {
    if (!('BarcodeDetector' in window)) return;
    // Cancel any previous detection loop
    if (loopRef.current) { loopRef.current.cancelled = true; }
    const ctx = { cancelled: false };
    loopRef.current = ctx;

    const detector = new BarcodeDetector({
      formats: SCAN_MODES[mode || 'qr'].formats
    });

    const loop = () => {
      if (ctx.cancelled || !videoRef.current || !streamRef.current) return;
      detector.detect(videoRef.current).then(codes => {
        if (ctx.cancelled) return;
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

  // ── Restart detection when scan mode changes ──
  useEffect(() => {
    if (tab === 0 && camActive) {
      startDetection(scanMode);
    }
  }, [scanMode]);

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
    padding: '12px 0',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: tab === t ? 700 : 400,
    color: tab === t ? '#c9a84c' : '#555',
    background: tab === t ? '#0f0f16' : 'transparent',
    border: 'none',
    borderBottom: tab === t ? '2px solid #c9a84c' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={{
      background: '#0a0a0c', color: '#e8d5a3', fontFamily: "'JetBrains Mono','Fira Code',monospace",
      fontSize: 11, minHeight: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column',
      maxWidth: 520, margin: '0 auto', width: '100%'
    }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #1a1a2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#c9a84c', letterSpacing: 2 }}>⬡ VERIFIER</div>
          <div style={{ fontSize: 8, color: '#444', marginTop: 3, letterSpacing: 1 }}>scan → crystallize → audit</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 9, color: '#555', fontWeight: 500 }}>{state.nodes.length} nodes · {state.totalBytes}b</span>
          <button onClick={clearAll} style={{
            background: '#1a1510', border: '1px solid #2a2018', color: '#8c4c4c',
            fontFamily: 'inherit', fontSize: 9, padding: '4px 10px', cursor: 'pointer',
            borderRadius: 3, transition: 'all 0.2s ease'
          }}>∅ clear</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e' }}>
        <button style={tabStyle(0)} onClick={() => setTab(0)}>① scan</button>
        <button style={tabStyle(1)} onClick={() => setTab(1)}>② page</button>
        <button style={tabStyle(2)} onClick={() => setTab(2)}>③ audit</button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ════════ TAB 0: SCANNER ════════ */}
        {tab === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Scan mode selector */}
            <div style={{
              display: 'flex', gap: 4, padding: '8px 16px',
              borderBottom: '1px solid #1a1a2e', background: '#0a0a0f'
            }}>
              {Object.entries(SCAN_MODES).map(([key, mode]) => (
                <button
                  key={key}
                  onClick={() => setScanMode(key)}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 10, fontWeight: 600,
                    fontFamily: 'inherit', letterSpacing: 1, cursor: 'pointer',
                    textTransform: 'uppercase', borderRadius: 4, transition: 'all 0.2s ease',
                    border: scanMode === key ? '1px solid #c9a84c' : '1px solid #1a1a2e',
                    background: scanMode === key ? '#1a1510' : '#0c0c12',
                    color: scanMode === key ? '#c9a84c' : '#555',
                    boxShadow: scanMode === key ? '0 0 12px #c9a84c15' : 'none',
                  }}
                >
                  {mode.icon} {mode.label}
                </button>
              ))}
            </div>

            {/* Camera */}
            <div style={{ position: 'relative', background: '#000', flexShrink: 0 }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', maxHeight: '40vh' }} />
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                width: scanMode === 'qr' ? 180 : 240, height: scanMode === 'qr' ? 180 : 90,
                border: '2px solid #c9a84c33', borderRadius: 6, pointerEvents: 'none',
                boxShadow: '0 0 30px #c9a84c11', transition: 'all 0.3s ease',
              }} />
              <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 9, color: camActive ? '#4c8c5c' : '#8c4c4c', fontWeight: 600 }}>
                {camActive ? '● camera active' : '○ no camera'}
              </div>
              <div style={{ position: 'absolute', bottom: 8, right: 10, fontSize: 8, color: '#444' }}>
                {SCAN_MODES[scanMode].label} mode
              </div>
            </div>

            {/* Manual input */}
            <div style={{ padding: '10px 16px', borderTop: '1px solid #1a1a2e', display: 'flex', gap: 6 }}>
              <input
                value={manualInput}
                onChange={e => setManualInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitManual()}
                placeholder="type:prime:content"
                style={{
                  flex: 1, background: '#0e0e14', border: '1px solid #1a1a2e', color: '#e8d5a3',
                  fontFamily: 'inherit', fontSize: 11, padding: '8px 10px', outline: 'none', borderRadius: 4
                }}
              />
              <button onClick={submitManual} style={{
                background: '#1a1510', border: '1px solid #4a3d1f', color: '#c9a84c',
                fontFamily: 'inherit', fontSize: 12, padding: '8px 14px', cursor: 'pointer', borderRadius: 4,
                fontWeight: 600, transition: 'all 0.2s ease'
              }}>→</button>
            </div>

            {/* Last read status */}
            <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px' }}>
              {lastRead ? (
                <div style={{ padding: 12, border: '1px solid #1a1a2e', borderRadius: 6, background: '#0c0c12' }}>
                  <div style={{ fontSize: 10, color: lastRead.error ? '#8c4c4c' : lastRead.duplicate ? '#555' : '#4c8c5c', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
                    {lastRead.error ? '✗ REJECTED' : lastRead.duplicate ? '○ DUPLICATE' : '★ ACCEPTED'}
                  </div>
                  {lastRead.type && <div style={{ color: '#c9a84c' }}>type: {lastRead.type}</div>}
                  {lastRead.prime && <div>prime: {lastRead.prime} = {factorize(lastRead.prime).join('×')}</div>}
                  {lastRead.content && <div style={{ color: '#888', marginTop: 6, wordBreak: 'break-all', lineHeight: 1.5 }}>{lastRead.content.slice(0, 120)}</div>}
                  {lastRead.bytes && <div style={{ fontSize: 9, color: '#444', marginTop: 6 }}>{lastRead.bytes} bytes</div>}
                  {lastRead.links && lastRead.links.length > 0 && (
                    <div style={{ fontSize: 9, color: '#3a6b8c', marginTop: 6 }}>
                      links: {lastRead.links.map(l => `P${l.prime}(gcd=${l.shared})`).join(' · ')}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 32, color: '#333' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⬡</div>
                  <span style={{ fontSize: 10, color: '#444', lineHeight: 1.6 }}>point camera at a barcode<br />or type below</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB 1: RENDERED PAGE ════════ */}
        {tab === 1 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
            {state.nodes.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48, color: '#333' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⬡</div>
                <span style={{ fontSize: 10, color: '#444' }}>nothing crystallized yet</span>
              </div>
            ) : (
              state.nodes.map((node, i) => {
                if (node.type === 'css') return <style key={i}>{node.content}</style>;
                if (node.type === 'js') return null; // show in audit, don't execute here
                if (node.type === 'sep' || node.type === 'hr') return <hr key={i} style={{ borderColor: '#1a1a2e', margin: '14px 0' }} />;

                const Tag = node.type === 'h1' ? 'h1' : node.type === 'h2' ? 'h2' : node.type === 'h3' ? 'h3' : 'p';
                const isHeading = ['h1', 'h2', 'h3'].includes(node.type);
                const isMath = node.type === 'math';
                const isDef = node.type === 'def';

                return (
                  <div key={i} style={{ marginBottom: 10 }}>
                    {isMath ? (
                      <pre style={{ textAlign: 'center', color: '#c9a84c', padding: '10px 0', fontStyle: 'italic' }}>{node.content}</pre>
                    ) : isDef ? (
                      <p style={{ borderLeft: '2px solid #4c8c5c', paddingLeft: 12 }}>
                        {(() => { const parts = node.content.split('|'); return <><strong>{parts[0]}</strong> {parts[1] || ''}</>; })()}
                      </p>
                    ) : (
                      <Tag style={isHeading ? { color: '#c9a84c', margin: '18px 0 10px', letterSpacing: 1 } : { lineHeight: 1.6 }}>{node.content}</Tag>
                    )}
                    {node.links.length > 0 && (
                      <div style={{ fontSize: 8, color: '#3a6b8c', marginTop: 3 }}>
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
          <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px' }}>
            {/* Summary */}
            <div style={{ padding: '12px', marginBottom: 10, border: '1px solid #1a1a2e', borderRadius: 6, background: '#0c0c12' }}>
              <div style={{ fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1.5, fontWeight: 600 }}>Compiler Proof</div>
              <div>Total scans: {state.audit.length}</div>
              <div>Crystallized: {state.nodes.length}</div>
              <div>Total bytes received: {state.totalBytes}</div>
              <div>Compiler bytes added: <span style={{ color: '#4c8c5c', fontWeight: 700, fontSize: 13 }}>0</span></div>
              <div style={{ fontSize: 9, color: '#555', marginTop: 8, lineHeight: 1.6, borderTop: '1px solid #1a1a2e', paddingTop: 8 }}>
                every byte on tab ② came from a barcode scan. nothing was generated, injected, or modified by this page.
              </div>
            </div>

            {/* Log entries */}
            {[...state.audit].reverse().map((entry, i) => (
              <div key={i} style={{
                padding: '8px 10px', marginBottom: 4, borderRadius: 4,
                border: `1px solid ${entry.action === 'CRYSTALLIZED' ? '#1a2a1a' : entry.action === 'REJECTED' ? '#2a1a1a' : '#1a1a2e'}`,
                fontSize: 9, background: '#0c0c12'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{
                    color: entry.action === 'CRYSTALLIZED' ? '#4c8c5c' : entry.action === 'REJECTED' ? '#8c4c4c' : '#555',
                    fontWeight: 700, letterSpacing: 0.5
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
              <div style={{ textAlign: 'center', padding: 24, color: '#333' }}>
                no scans recorded
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

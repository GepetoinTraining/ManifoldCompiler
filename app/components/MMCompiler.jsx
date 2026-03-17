"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { gcd, factorize, canAccept, PHI } from "@/lib/gate";
import {
  loadLoop, saveLoop, getGenerated, getUnconsumed, addPrime, multiplyValues,
  appendScan, loadTensors, saveTensors, loadNodes, saveNodes,
  loadPending, savePending, loadAudit, appendAudit, consumeValue, clearAll,
} from "@/lib/storage";

// ════════════════════════════════════════════════════════════
// MM COMPILER
// ════════════════════════════════════════════════════════════
// The IDE builds ONLY:
//   1. The gate (canAccept)
//   2. The ledger (mm_loop)
//   3. The scan input
//   4. The DB visualizer
// Everything else is earned through barcodes.
// ════════════════════════════════════════════════════════════

const PHI2 = PHI * PHI; // ≈ 2.618 — cost of a prime

// ── Barcode parser ──
function parse(raw) {
  const trimmed = raw.trim();

  // Raw number (no colons) — a prime being generated
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed);
    if (n >= 2) return { type: '_prime', prime: n, content: '', raw: trimmed, bytes: new Blob([trimmed]).size };
    return null;
  }

  // type:prime:content
  const i = trimmed.indexOf(':');
  if (i < 0) return null;
  const j = trimmed.indexOf(':', i + 1);
  if (j < 0) return null;
  const type = trimmed.slice(0, i);
  const prime = parseInt(trimmed.slice(i + 1, j));
  const content = trimmed.slice(j + 1);
  if (isNaN(prime)) return null;
  return { type, prime, content, raw: trimmed, bytes: new Blob([trimmed]).size };
}

// ── Styles (app shell only — NOT earned content) ──
const S = {
  app: {
    background: '#0a0a0c', color: '#e8d5a3', fontFamily: "'JetBrains Mono','Fira Code',monospace",
    fontSize: 11, minHeight: 'calc(100vh - 50px)', display: 'flex', flexDirection: 'column',
    maxWidth: 600, margin: '0 auto', width: '100%',
  },
  header: {
    padding: '14px 20px', borderBottom: '1px solid #1a1a2e', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: 700, color: '#c9a84c', letterSpacing: 2 },
  sub: { fontSize: 8, color: '#444', marginTop: 3, letterSpacing: 1 },
  stat: { fontSize: 9, color: '#555', fontWeight: 500 },
  btn: {
    background: '#1a1510', border: '1px solid #2a2018', color: '#8c4c4c',
    fontFamily: 'inherit', fontSize: 9, padding: '4px 10px', cursor: 'pointer', borderRadius: 3,
  },
  input: {
    flex: 1, background: '#0e0e14', border: '1px solid #1a1a2e', color: '#e8d5a3',
    fontFamily: 'inherit', fontSize: 11, padding: '8px 10px', outline: 'none', borderRadius: 4,
  },
  submitBtn: {
    background: '#1a1510', border: '1px solid #4a3d1f', color: '#c9a84c',
    fontFamily: 'inherit', fontSize: 12, padding: '8px 14px', cursor: 'pointer', borderRadius: 4, fontWeight: 600,
  },
  calcInput: {
    width: 60, background: '#0e0e14', border: '1px solid #1a1a2e', color: '#e8d5a3',
    fontFamily: 'inherit', fontSize: 11, padding: '6px 8px', outline: 'none', borderRadius: 4, textAlign: 'center',
  },
  result: {
    padding: 12, margin: '8px 16px', border: '1px solid #1a1a2e', borderRadius: 6,
    background: '#0c0c12', fontSize: 11,
  },
  modeBtn: (active) => ({
    flex: 1, padding: '7px 0', fontSize: 10, fontWeight: 600,
    fontFamily: 'inherit', letterSpacing: 1, cursor: 'pointer',
    textTransform: 'uppercase', borderRadius: 4, transition: 'all 0.2s ease',
    border: active ? '1px solid #c9a84c' : '1px solid #1a1a2e',
    background: active ? '#1a1510' : '#0c0c12',
    color: active ? '#c9a84c' : '#555',
    boxShadow: active ? '0 0 12px #c9a84c15' : 'none',
  }),
  tab: (active) => ({
    flex: 1, padding: '12px 0', textAlign: 'center', fontSize: 11,
    fontWeight: active ? 700 : 400, color: active ? '#c9a84c' : '#555',
    background: active ? '#0f0f16' : 'transparent',
    border: 'none', borderBottom: active ? '2px solid #c9a84c' : '2px solid transparent',
    cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 1.5, textTransform: 'uppercase',
    transition: 'all 0.2s ease',
  }),
  tableHeader: { borderBottom: '2px solid #333', textAlign: 'left' },
  th: { padding: '6px 8px', color: '#c9a84c', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' },
  td: { padding: '4px 8px', borderBottom: '1px solid #111' },
  section: { padding: '12px 16px', marginBottom: 8, border: '1px solid #1a1a2e', borderRadius: 6, background: '#0c0c12' },
  sectionTitle: { fontSize: 9, color: '#555', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 1.5, fontWeight: 600 },
};

// ════════════════════════════════════════════════════════════
// COMPONENT
// ════════════════════════════════════════════════════════════

export default function MMCompiler() {
  const [tab, setTab] = useState(0);
  const [loop, setLoop] = useState([]);
  const [manualInput, setManualInput] = useState('');
  const [lastResult, setLastResult] = useState(null);
  const [camActive, setCamActive] = useState(false);
  const [scanMode, setScanMode] = useState('qr');
  const [mulA, setMulA] = useState('');
  const [mulB, setMulB] = useState('');

  const videoRef = useRef(null);
  const scanRef = useRef({ last: '', time: 0 });
  const streamRef = useRef(null);
  const loopRef = useRef(null);

  // ── Load on mount ──
  useEffect(() => { setLoop(loadLoop()); }, []);

  // ── Persist loop ──
  useEffect(() => { if (loop.length > 0) saveLoop(loop); }, [loop]);

  // ── Camera lifecycle ──
  useEffect(() => {
    if (tab === 0 && !camActive) startCamera();
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        setCamActive(false);
      }
    };
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
    } catch { setCamActive(false); }
  }, [scanMode]);

  const startDetection = useCallback((mode) => {
    if (!('BarcodeDetector' in window)) return;
    if (loopRef.current) loopRef.current.cancelled = true;
    const ctx = { cancelled: false };
    loopRef.current = ctx;

    const formats = mode === 'qr'
      ? ['qr_code', 'data_matrix']
      : ['code_128', 'code_39', 'ean_13', 'ean_8'];
    const detector = new BarcodeDetector({ formats });

    const detect = () => {
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
      requestAnimationFrame(detect);
    };
    detect();
  }, []);

  useEffect(() => {
    if (tab === 0 && camActive) startDetection(scanMode);
  }, [scanMode]);

  // ══════════════════════════════════════════
  // SCAN HANDLER — routes by type through gate
  // ══════════════════════════════════════════
  const handleScan = useCallback((raw) => {
    const parsed = parse(raw);
    if (!parsed) {
      setLastResult({ action: 'REJECTED', reason: 'unparseable', raw: raw.slice(0, 100) });
      appendAudit({ action: 'REJECTED', raw: raw.slice(0, 100), reason: 'unparseable' });
      appendScan(raw);
      return;
    }

    appendScan(raw);
    const currentLoop = loadLoop();
    const generated = getGenerated(currentLoop);

    // ── Raw prime ──
    if (parsed.type === '_prime') {
      const result = addPrime(currentLoop, parsed.prime, PHI2);
      if (result.alreadyExists) {
        setLastResult({ action: 'DUPLICATE', prime: parsed.prime });
        appendAudit({ action: 'DUPLICATE', prime: parsed.prime, type: 'prime' });
        return;
      }
      setLoop(result.loop);
      saveLoop(result.loop);
      setLastResult({
        action: 'ACCEPTED', type: 'prime', prime: parsed.prime,
        newRows: result.newRows.length, factors: factorize(parsed.prime),
      });
      appendAudit({ action: 'PRIME_ADDED', prime: parsed.prime, composites: result.newRows.length - 1, bytes: parsed.bytes });
      replayPending(result.loop);
      return;
    }

    // ── CSS tensor — exact prime required ──
    if (parsed.type === 'css') {
      if (!generated.has(parsed.prime)) {
        addPendingBarcode(parsed.prime, raw);
        setLastResult({ action: 'PENDING', type: 'css', prime: parsed.prime, reason: 'prime not generated' });
        appendAudit({ action: 'PENDING', type: 'css', prime: parsed.prime, bytes: parsed.bytes });
        return;
      }
      const tensors = loadTensors();
      tensors[parsed.prime] = parsed.content;
      saveTensors(tensors);
      const consumed = consumeValue(currentLoop, parsed.prime);
      setLoop(consumed);
      saveLoop(consumed);
      setLastResult({ action: 'ACCEPTED', type: 'css', prime: parsed.prime, bytes: parsed.bytes });
      appendAudit({ action: 'TENSOR_APPLIED', type: 'css', prime: parsed.prime, bytes: parsed.bytes });
      return;
    }

    // ── Content types — gated by canAccept ──
    const contentTypes = ['h1', 'h2', 'h3', 'p', 'math', 'def', 'hr', 'meta'];
    if (contentTypes.includes(parsed.type)) {
      if (!canAccept(parsed.prime, generated)) {
        addPendingBarcode(parsed.prime, raw);
        setLastResult({ action: 'PENDING', type: parsed.type, prime: parsed.prime, reason: 'gate closed' });
        appendAudit({ action: 'PENDING', type: parsed.type, prime: parsed.prime, bytes: parsed.bytes });
        return;
      }
      const nodes = loadNodes();
      nodes.push({
        type: parsed.type, prime: parsed.prime, content: parsed.content,
        factors: factorize(parsed.prime), tick: nodes.length,
        timestamp: new Date().toISOString(), bytes: parsed.bytes,
      });
      saveNodes(nodes);
      setLastResult({ action: 'ACCEPTED', type: parsed.type, prime: parsed.prime, bytes: parsed.bytes, content: parsed.content.slice(0, 80) });
      appendAudit({ action: 'CRYSTALLIZED', type: parsed.type, prime: parsed.prime, bytes: parsed.bytes });
      return;
    }

    // ── All other types (js, tp, tpb, op, q, lex, etc.) ──
    if (!canAccept(parsed.prime, generated)) {
      addPendingBarcode(parsed.prime, raw);
      setLastResult({ action: 'PENDING', type: parsed.type, prime: parsed.prime, reason: 'gate closed' });
      appendAudit({ action: 'PENDING', type: parsed.type, prime: parsed.prime, bytes: parsed.bytes });
      return;
    }
    setLastResult({ action: 'ACCEPTED', type: parsed.type, prime: parsed.prime, bytes: parsed.bytes, content: parsed.content.slice(0, 60) });
    appendAudit({ action: 'ACCEPTED', type: parsed.type, prime: parsed.prime, bytes: parsed.bytes });
  }, []);

  function addPendingBarcode(prime, raw) {
    const pending = loadPending();
    if (!pending[prime]) pending[prime] = [];
    pending[prime].push(raw);
    savePending(pending);
  }

  function replayPending(currentLoop) {
    const pending = loadPending();
    const generated = getGenerated(currentLoop);
    const newPending = {};

    for (const [primeStr, barcodes] of Object.entries(pending)) {
      const prime = parseInt(primeStr);
      for (const barcode of barcodes) {
        const parsed = parse(barcode);
        if (!parsed) continue;
        const passes = parsed.type === 'css'
          ? generated.has(parsed.prime)
          : canAccept(parsed.prime, generated);
        if (passes) {
          handleScan(barcode);
        } else {
          if (!newPending[prime]) newPending[prime] = [];
          newPending[prime].push(barcode);
        }
      }
    }
    savePending(newPending);
  }

  // ── Calculator ──
  const doMultiply = () => {
    const a = parseInt(mulA), b = parseInt(mulB);
    if (isNaN(a) || isNaN(b)) return;
    const currentLoop = loadLoop();
    const result = multiplyValues(currentLoop, a, b);
    if (result.added) {
      setLoop(result.loop);
      saveLoop(result.loop);
      setLastResult({ action: 'COMPOSITE', product: result.product, origin: `${a}×${b}` });
      appendAudit({ action: 'COMPOSITE', product: result.product, origin: `${a}×${b}` });
    } else {
      setLastResult({ action: 'REJECTED', reason: result.reason, raw: `${a}×${b}` });
    }
    setMulA(''); setMulB('');
  };

  const submitManual = () => {
    if (manualInput.trim()) { handleScan(manualInput.trim()); setManualInput(''); }
  };

  const resetAll = () => { clearAll(); setLoop([]); setLastResult(null); };

  // ══════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════

  const generated = getGenerated(loop);
  const unconsumed = getUnconsumed(loop);
  const primes = loop.filter(r => r.type === 'prime');
  const composites = loop.filter(r => r.type === 'composite');
  const pending = loadPending();
  const pendingCount = Object.values(pending).flat().length;
  const tensors = loadTensors();
  const tensorCount = Object.keys(tensors).length;
  const nodes = loadNodes();

  const resultColor = (action) =>
    action === 'ACCEPTED' || action === 'COMPOSITE' ? '#4c8c5c'
    : action === 'PENDING' ? '#cc8800'
    : action === 'DUPLICATE' ? '#555'
    : '#8c4c4c';

  return (
    <div style={S.app}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <div style={S.title}>⬡ VERIFIER</div>
          <div style={S.sub}>scan → crystallize → audit</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <span style={S.stat}>{primes.length}P · {composites.length}C · {tensorCount}T · {nodes.length}N</span>
          <button onClick={resetAll} style={S.btn}>∅ reset</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1a1a2e' }}>
        <button style={S.tab(tab === 0)} onClick={() => setTab(0)}>① Scan</button>
        <button style={S.tab(tab === 1)} onClick={() => setTab(1)}>② Page</button>
        <button style={S.tab(tab === 2)} onClick={() => setTab(2)}>③ Studio</button>
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* ════════ TAB 0: SCAN ════════ */}
        {tab === 0 && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Mode selector */}
            <div style={{ display: 'flex', gap: 4, padding: '8px 12px', borderBottom: '1px solid #1a1a2e', background: '#0a0a0f' }}>
              <button onClick={() => setScanMode('qr')} style={S.modeBtn(scanMode === 'qr')}>⬡ QR Code</button>
              <button onClick={() => setScanMode('barcode')} style={S.modeBtn(scanMode === 'barcode')}>⫼ Barcode</button>
              <button onClick={() => setScanMode('raw')} style={S.modeBtn(scanMode === 'raw')}>⌨ Raw</button>
            </div>

            {/* Camera (hidden in raw mode) */}
            {scanMode !== 'raw' ? (
              <div style={{ position: 'relative', background: '#000', flexShrink: 0 }}>
                <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block', maxHeight: '35vh' }} />
                <div style={{
                  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                  width: scanMode === 'qr' ? 150 : 200, height: scanMode === 'qr' ? 150 : 70,
                  border: '2px solid #c9a84c33', borderRadius: 6, pointerEvents: 'none',
                  boxShadow: '0 0 30px #c9a84c11', transition: 'all 0.3s ease',
                }} />
                <div style={{ position: 'absolute', bottom: 6, left: 8, fontSize: 9, color: camActive ? '#4c8c5c' : '#8c4c4c', fontWeight: 600 }}>
                  {camActive ? '● camera' : '○ no camera'}
                </div>
                <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 8, color: '#444' }}>
                  {scanMode === 'qr' ? 'QR' : 'Barcode'}
                </div>
              </div>
            ) : (
              <div style={{ padding: '16px 12px', background: '#0c0c12', borderBottom: '1px solid #1a1a2e', textAlign: 'center' }}>
                <div style={{ fontSize: 9, color: '#555', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>raw number input</div>
                <div style={{ display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[2, 3, 5, 7, 11, 13, 17, 19, 23, 29].map(p => (
                    <button key={p} onClick={() => handleScan(String(p))} style={{
                      background: generated.has(p) ? '#1a2a1a' : '#1a1510',
                      border: generated.has(p) ? '1px solid #2a3a2a' : '1px solid #4a3d1f',
                      color: generated.has(p) ? '#4c8c5c' : '#c9a84c',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                      padding: '8px 12px', cursor: 'pointer', borderRadius: 4,
                      minWidth: 44, transition: 'all 0.2s ease',
                    }}>{p}{generated.has(p) ? ' ✓' : ''}</button>
                  ))}
                </div>
              </div>
            )}

            {/* Manual input + calculator in one row on mobile */}
            <div style={{ padding: '8px 12px', borderTop: '1px solid #1a1a2e', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={manualInput} onChange={e => setManualInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitManual()}
                  placeholder="type:prime:content  or  raw number" style={S.input} />
                <button onClick={submitManual} style={S.submitBtn}>→</button>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 8, color: '#555', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>×</span>
                <input value={mulA} onChange={e => setMulA(e.target.value)} placeholder="a" style={S.calcInput} />
                <span style={{ color: '#555', fontSize: 10 }}>×</span>
                <input value={mulB} onChange={e => setMulB(e.target.value)} placeholder="b"
                  onKeyDown={e => e.key === 'Enter' && doMultiply()} style={S.calcInput} />
                <button onClick={doMultiply} style={{ ...S.submitBtn, padding: '6px 10px', fontSize: 10 }}>=</button>
              </div>
            </div>

            {/* Last result */}
            <div style={{ flex: 1, overflow: 'auto', padding: '0 12px 12px' }}>
              {lastResult ? (
                <div style={S.result}>
                  <div style={{ fontWeight: 700, color: resultColor(lastResult.action), letterSpacing: 1, marginBottom: 4 }}>
                    {lastResult.action === 'ACCEPTED' ? '★' : lastResult.action === 'PENDING' ? '◌' : lastResult.action === 'COMPOSITE' ? '◆' : lastResult.action === 'DUPLICATE' ? '○' : '✗'} {lastResult.action}
                  </div>
                  {lastResult.type && <div>type: {lastResult.type}</div>}
                  {lastResult.prime && <div>prime: {lastResult.prime} = {factorize(lastResult.prime).join('×')}</div>}
                  {lastResult.product && <div>product: {lastResult.product} ({lastResult.origin})</div>}
                  {lastResult.newRows && <div style={{ color: '#4c8c5c' }}>+{lastResult.newRows} values generated</div>}
                  {lastResult.bytes && <div style={{ color: '#444' }}>{lastResult.bytes} bytes</div>}
                  {lastResult.content && <div style={{ color: '#666', wordBreak: 'break-all', marginTop: 4 }}>{lastResult.content}</div>}
                  {lastResult.reason && <div style={{ color: '#8c4c4c' }}>{lastResult.reason}</div>}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: 24, color: '#333' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⬡</div>
                  <span style={{ fontSize: 10, color: '#444', lineHeight: 1.6 }}>scan a prime to begin<br />or type below</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB 1: PAGE (earned content) ════════ */}
        {tab === 1 && (
          <div style={{ flex: 1, overflow: 'auto' }}>
            {/* Inject earned CSS tensors */}
            {Object.entries(tensors).map(([prime, css]) => (
              <style key={prime} data-tensor={prime}>{css}</style>
            ))}

            {/* Earned content zone — NO shell styling here */}
            <div id="mm-page" data-tensors={tensorCount} data-nodes={nodes.length}>
              {nodes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: '#333', fontFamily: 'inherit' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⬡</div>
                  <div style={{ fontSize: 10, color: '#444' }}>void — scan content to begin crystallization</div>
                  <div style={{ fontSize: 9, color: '#333', marginTop: 8 }}>
                    {tensorCount > 0 ? `${tensorCount} tensor${tensorCount > 1 ? 's' : ''} active` : 'no tensors loaded'}
                    {' · '}{primes.length > 0 ? `${primes.length} primes` : 'no primes'}
                    {pendingCount > 0 ? ` · ${pendingCount} pending` : ''}
                  </div>
                </div>
              ) : (
                nodes.map((node, i) => {
                  if (node.type === 'hr') return <hr key={i} data-p={node.prime} />;
                  if (node.type === 'meta') {
                    if (typeof document !== 'undefined') document.title = node.content;
                    return null;
                  }
                  if (node.type === 'math') return (
                    <pre key={i} data-p={node.prime} data-f={node.factors?.join('×')}
                      style={{ textAlign: 'center', fontStyle: 'italic', padding: '8px 0' }}>
                      {node.content}
                    </pre>
                  );
                  if (node.type === 'def') {
                    const parts = node.content.split('|');
                    return (
                      <p key={i} data-p={node.prime} data-f={node.factors?.join('×')}
                        style={{ borderLeft: '2px solid currentColor', paddingLeft: 12 }}>
                        <strong>{parts[0]}</strong> {parts[1] || ''}
                      </p>
                    );
                  }
                  const Tag = ['h1', 'h2', 'h3'].includes(node.type) ? node.type : 'p';
                  return <Tag key={i} data-p={node.prime} data-f={node.factors?.join('×')}>{node.content}</Tag>;
                })
              )}
            </div>
          </div>
        )}

        {/* ════════ TAB 2: STUDIO ════════ */}
        {tab === 2 && (
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            {/* Summary */}
            <div style={S.section}>
              <div style={S.sectionTitle}>mm_loop</div>
              <div>{loop.length} rows · {primes.length} primes · {composites.length} composites</div>
              <div>Generated set: {generated.size} values · Tensors: {tensorCount} · Nodes: {nodes.length}</div>
              <div>Unconsumed: {unconsumed.length}</div>
              {pendingCount > 0 && <div style={{ color: '#cc8800' }}>Pending: {pendingCount} barcodes waiting</div>}
              <div style={{ fontSize: 9, color: '#555', marginTop: 6, borderTop: '1px solid #1a1a2e', paddingTop: 6 }}>
                compiler bytes added: <span style={{ color: '#4c8c5c', fontWeight: 700, fontSize: 13 }}>0</span>
              </div>
            </div>

            {/* Ledger table */}
            {loop.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
                  <thead>
                    <tr style={S.tableHeader}>
                      <th style={S.th}>tick</th>
                      <th style={S.th}>value</th>
                      <th style={S.th}>type</th>
                      <th style={S.th}>origin</th>
                      <th style={S.th}>cost</th>
                      <th style={S.th}>used</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loop.map((row, i) => (
                      <tr key={i}>
                        <td style={S.td}>{row.tick}</td>
                        <td style={{ ...S.td, fontWeight: row.type === 'prime' ? 700 : 400, color: row.type === 'prime' ? '#c9a84c' : '#888' }}>{row.value}</td>
                        <td style={{ ...S.td, color: row.type === 'prime' ? '#4c8c5c' : '#555' }}>{row.type}</td>
                        <td style={S.td}>{row.origin}</td>
                        <td style={S.td}>{row.cost > 0 ? `φ²` : '0'}</td>
                        <td style={S.td}>{row.consumed ? '✓' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 32, color: '#333' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>⬡</div>
                <span style={{ fontSize: 10, color: '#444' }}>ledger empty — scan a prime to begin</span>
              </div>
            )}

            {/* Tensors */}
            {tensorCount > 0 && (
              <div style={{ ...S.section, marginTop: 12 }}>
                <div style={S.sectionTitle}>Tensors ({tensorCount})</div>
                {Object.entries(tensors).map(([prime, css]) => (
                  <div key={prime} style={{ padding: '3px 0', fontSize: 10 }}>
                    <span style={{ color: '#c9a84c' }}>P{prime}</span>: <span style={{ color: '#666' }}>{css.slice(0, 60)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Pending queue */}
            {pendingCount > 0 && (
              <div style={{ ...S.section, marginTop: 12 }}>
                <div style={S.sectionTitle}>Pending ({pendingCount})</div>
                {Object.entries(pending).map(([prime, barcodes]) => (
                  <div key={prime} style={{ padding: '3px 0', color: '#cc8800', fontSize: 10 }}>
                    P{prime}: {barcodes.length} barcode{barcodes.length > 1 ? 's' : ''} — {barcodes.map(b => b.slice(0, 30)).join(', ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

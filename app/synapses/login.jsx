"use client";
import { useState } from "react";

const S = {
  container: {
    minHeight: 'calc(100vh - 50px)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#050510', fontFamily: "'JetBrains Mono', monospace",
  },
  card: {
    background: '#0a0a12', border: '1px solid #1a1a2e', borderRadius: 8,
    padding: 32, width: 360, maxWidth: '90vw',
  },
  title: { fontSize: 18, color: '#c9a84c', fontWeight: 700, marginBottom: 4, letterSpacing: 2 },
  sub: { fontSize: 10, color: '#555', marginBottom: 24, letterSpacing: 1 },
  input: {
    width: '100%', background: '#0e0e14', border: '1px solid #1a1a2e', color: '#e8d5a3',
    fontFamily: 'inherit', fontSize: 12, padding: '10px 12px', borderRadius: 4,
    outline: 'none', marginBottom: 12, boxSizing: 'border-box',
  },
  btn: {
    width: '100%', background: '#1a1510', border: '1px solid #4a3d1f', color: '#c9a84c',
    fontFamily: 'inherit', fontSize: 12, padding: '10px', cursor: 'pointer',
    borderRadius: 4, fontWeight: 600, letterSpacing: 1, marginTop: 8,
  },
  toggle: {
    background: 'none', border: 'none', color: '#555', fontSize: 10,
    cursor: 'pointer', marginTop: 16, fontFamily: 'inherit',
  },
  error: { color: '#8c4c4c', fontSize: 10, marginTop: 8 },
};

export default function LoginGate({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profession, setProfession] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name, profession };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.uuid) {
        // Store uuid locally too
        localStorage.setItem('torus_uuid', data.uuid);
        if (data.name) localStorage.setItem('torus_name', data.name);
        onAuth(data.uuid);
      }
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={S.container}>
      <div style={S.card}>
        <div style={S.title}>&#x2B21; Synapses</div>
        <div style={S.sub}>{mode === 'login' ? 'connect to the torus' : 'create your geometry'}</div>

        {mode === 'register' && (
          <>
            <input style={S.input} placeholder="name" value={name} onChange={e => setName(e.target.value)} />
            <input style={S.input} placeholder="profession (optional)" value={profession} onChange={e => setProfession(e.target.value)} />
          </>
        )}
        <input style={S.input} type="email" placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={S.input} type="password" placeholder="password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()} />

        <button style={{...S.btn, opacity: loading ? 0.5 : 1}} onClick={submit} disabled={loading}>
          {loading ? '...' : mode === 'login' ? 'Connect' : 'Create'}
        </button>

        {error && <div style={S.error}>{error}</div>}

        <button style={S.toggle} onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}>
          {mode === 'login' ? 'new? create your geometry \u2192' : '\u2190 already have a torus? connect'}
        </button>
      </div>
    </div>
  );
}

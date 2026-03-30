"use client";

import Link from "next/link";

const features = [
  {
    title: "Persistent Memory",
    description:
      "Every conversation builds on the last. Your AI remembers what matters and forgets what doesn't.",
  },
  {
    title: "Private by Geometry",
    description:
      "Your data lives on your device. The math prevents others from seeing it. Not policies. Topology.",
  },
  {
    title: "Gets Smarter With Use",
    description:
      "The more you talk, the faster it gets. Shared vocabulary grows. Context compresses. The flywheel spins.",
  },
];

export default function Home() {
  return (
    <div style={styles.page}>
      {/* Hero */}
      <section style={styles.hero}>
        <h1 style={styles.heroTitle}>⬡ Manifold Compiler</h1>
        <p style={styles.tagline}>LLM memory done right.</p>
        <p style={styles.subtitle}>
          Your conversations have structure. We preserve it.
          <br />
          No vectors. No embeddings. Pure geometry.
        </p>
      </section>

      {/* Feature cards */}
      <section style={styles.cards}>
        {features.map((f) => (
          <div key={f.title} style={styles.card}>
            <h3 style={styles.cardTitle}>{f.title}</h3>
            <p style={styles.cardDesc}>{f.description}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section style={styles.cta}>
        <Link href="/synapses" style={styles.ctaButton}>
          Start a Synapse →
        </Link>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <p style={styles.footerLine}>
          Built on prime arithmetic. Runs on less than a lightbulb.
        </p>
        <p style={styles.footerCopy}>© 2026 Manifold Matrices</p>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#050510",
    color: "#e8d5a3",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 20px",
  },
  hero: {
    textAlign: "center",
    marginTop: "100px",
    marginBottom: "60px",
    maxWidth: "680px",
  },
  heroTitle: {
    fontSize: "clamp(32px, 6vw, 56px)",
    fontWeight: 700,
    color: "#c9a84c",
    letterSpacing: "3px",
    margin: "0 0 16px 0",
    lineHeight: 1.1,
    textShadow: "0 0 40px rgba(201,168,76,0.25)",
  },
  tagline: {
    fontSize: "clamp(16px, 3vw, 22px)",
    color: "#06B6D4",
    fontWeight: 600,
    letterSpacing: "1px",
    margin: "0 0 20px 0",
  },
  subtitle: {
    fontSize: "clamp(12px, 1.8vw, 15px)",
    color: "#e8d5a3",
    opacity: 0.7,
    lineHeight: 1.8,
    margin: 0,
  },
  cards: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "20px",
    maxWidth: "900px",
    width: "100%",
    marginBottom: "60px",
  },
  card: {
    background: "#0a0a12",
    border: "1px solid #1a1a2e",
    borderRadius: "6px",
    padding: "28px 24px",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#c9a84c",
    letterSpacing: "1px",
    textTransform: "uppercase",
    margin: "0 0 12px 0",
  },
  cardDesc: {
    fontSize: "12px",
    color: "#e8d5a3",
    opacity: 0.75,
    lineHeight: 1.7,
    margin: 0,
  },
  cta: {
    textAlign: "center",
    marginBottom: "80px",
  },
  ctaButton: {
    display: "inline-block",
    padding: "14px 36px",
    border: "1px solid #c9a84c",
    borderRadius: "4px",
    color: "#c9a84c",
    fontSize: "13px",
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    textDecoration: "none",
    transition: "all 0.3s ease",
    background: "transparent",
    cursor: "pointer",
  },
  footer: {
    marginTop: "auto",
    paddingBottom: "32px",
    textAlign: "center",
  },
  footerLine: {
    fontSize: "11px",
    color: "#555",
    letterSpacing: "0.5px",
    margin: "0 0 6px 0",
  },
  footerCopy: {
    fontSize: "10px",
    color: "#333",
    letterSpacing: "0.5px",
    margin: 0,
  },
};

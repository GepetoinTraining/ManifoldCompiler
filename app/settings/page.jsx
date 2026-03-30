"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEYS = [
  { key: "mm_loop", label: "Loop Entries" },
  { key: "mm_nodes", label: "Nodes" },
  { key: "mm_tensors", label: "Tensors" },
  { key: "mm_scans", label: "Scans" },
  { key: "mm_audit", label: "Audit Log" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [uuid, setUuid] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profession, setProfession] = useState("");
  const [counts, setCounts] = useState({});
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem("torus_uuid");
    if (!id) {
      router.push("/synapses");
      return;
    }
    setUuid(id);
    setName(localStorage.getItem("torus_name") || "");
    setEmail(localStorage.getItem("torus_email") || "");
    setProfession(localStorage.getItem("torus_profession") || "");

    // Count items in each storage key
    const c = {};
    STORAGE_KEYS.forEach(({ key }) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) {
          c[key] = 0;
        } else {
          const parsed = JSON.parse(raw);
          c[key] = Array.isArray(parsed)
            ? parsed.length
            : typeof parsed === "object"
            ? Object.keys(parsed).length
            : 1;
        }
      } catch {
        c[key] = 0;
      }
    });
    setCounts(c);
  }, [router]);

  function downloadKey(key) {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const blob = new Blob([raw], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${key}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordMsg("");
    if (!currentPassword || !newPassword) {
      setPasswordMsg("Both fields are required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg("New password must be at least 6 characters.");
      return;
    }
    try {
      const res = await fetch("/api/auth", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid,
          currentPassword,
          newPassword,
        }),
      });
      if (res.ok) {
        setPasswordMsg("Password updated.");
        setCurrentPassword("");
        setNewPassword("");
      } else {
        const data = await res.json().catch(() => ({}));
        setPasswordMsg(data.error || "Failed to update password.");
      }
    } catch {
      setPasswordMsg("Network error.");
    }
  }

  function handleClearData() {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    STORAGE_KEYS.forEach(({ key }) => localStorage.removeItem(key));
    localStorage.removeItem("torus_uuid");
    localStorage.removeItem("torus_name");
    localStorage.removeItem("torus_email");
    localStorage.removeItem("torus_profession");
    setConfirmClear(false);
    router.push("/");
  }

  return (
    <div style={styles.page}>
      <h1 style={styles.heading}>Settings</h1>

      {/* User Info */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>User Info</h2>
        <div style={styles.infoGrid}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Name</span>
            <span style={styles.infoValue}>{name || "—"}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Email</span>
            <span style={styles.infoValue}>{email || "—"}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>UUID</span>
            <span style={{ ...styles.infoValue, fontSize: "10px", wordBreak: "break-all" }}>
              {uuid || "—"}
            </span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Profession</span>
            <span style={styles.infoValue}>{profession || "—"}</span>
          </div>
        </div>
      </section>

      {/* Local DB */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Local Database</h2>
        <div style={styles.dbGrid}>
          {STORAGE_KEYS.map(({ key, label }) => (
            <div key={key} style={styles.dbItem}>
              <span style={styles.dbCount}>{counts[key] ?? 0}</span>
              <span style={styles.dbLabel}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Download */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Download Data</h2>
        <div style={styles.downloadRow}>
          {STORAGE_KEYS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => downloadKey(key)}
              style={styles.downloadBtn}
              onMouseEnter={(e) => {
                e.target.style.borderColor = "#c9a84c";
                e.target.style.color = "#c9a84c";
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = "#1a1a2e";
                e.target.style.color = "#e8d5a3";
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Change Password */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Change Password</h2>
        <form onSubmit={handleChangePassword} style={styles.form}>
          <input
            type="password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.submitBtn}>
            Update Password
          </button>
          {passwordMsg && (
            <p
              style={{
                ...styles.msg,
                color: passwordMsg.includes("updated") ? "#4c8c5c" : "#8c4c4c",
              }}
            >
              {passwordMsg}
            </p>
          )}
        </form>
      </section>

      {/* Danger Zone */}
      <section style={{ ...styles.section, borderColor: "#8c4c4c" }}>
        <h2 style={{ ...styles.sectionTitle, color: "#8c4c4c" }}>Danger Zone</h2>
        <p style={styles.dangerText}>
          This will erase all local data including your session. This cannot be undone.
        </p>
        <button
          onClick={handleClearData}
          style={confirmClear ? styles.dangerBtnConfirm : styles.dangerBtn}
        >
          {confirmClear ? "Confirm — erase everything" : "Clear local data"}
        </button>
      </section>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: "640px",
    margin: "0 auto",
    padding: "32px 20px 60px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    color: "#e8d5a3",
  },
  heading: {
    fontSize: "22px",
    fontWeight: 700,
    color: "#c9a84c",
    letterSpacing: "2px",
    marginBottom: "32px",
  },
  section: {
    background: "#0a0a12",
    border: "1px solid #1a1a2e",
    borderRadius: "6px",
    padding: "24px",
    marginBottom: "24px",
  },
  sectionTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#c9a84c",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    margin: "0 0 16px 0",
  },
  infoGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  infoLabel: {
    fontSize: "11px",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    flexShrink: 0,
  },
  infoValue: {
    fontSize: "12px",
    color: "#e8d5a3",
    textAlign: "right",
  },
  dbGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
    gap: "12px",
  },
  dbItem: {
    textAlign: "center",
    padding: "12px 8px",
    background: "#0e0e14",
    borderRadius: "4px",
    border: "1px solid #1a1a2e",
  },
  dbCount: {
    display: "block",
    fontSize: "20px",
    fontWeight: 700,
    color: "#06B6D4",
    marginBottom: "4px",
  },
  dbLabel: {
    fontSize: "9px",
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  downloadRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  downloadBtn: {
    padding: "8px 14px",
    background: "transparent",
    border: "1px solid #1a1a2e",
    borderRadius: "4px",
    color: "#e8d5a3",
    fontSize: "10px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursor: "pointer",
    transition: "all 0.2s ease",
    letterSpacing: "0.5px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    maxWidth: "320px",
  },
  input: {
    padding: "10px 12px",
    background: "#0e0e14",
    border: "1px solid #1a1a2e",
    borderRadius: "4px",
    color: "#e8d5a3",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    outline: "none",
  },
  submitBtn: {
    padding: "10px 16px",
    background: "transparent",
    border: "1px solid #c9a84c",
    borderRadius: "4px",
    color: "#c9a84c",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursor: "pointer",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.2s ease",
    alignSelf: "flex-start",
  },
  msg: {
    fontSize: "11px",
    margin: "4px 0 0 0",
  },
  dangerText: {
    fontSize: "11px",
    color: "#555",
    margin: "0 0 14px 0",
    lineHeight: 1.6,
  },
  dangerBtn: {
    padding: "10px 16px",
    background: "transparent",
    border: "1px solid #8c4c4c",
    borderRadius: "4px",
    color: "#8c4c4c",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursor: "pointer",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.2s ease",
  },
  dangerBtnConfirm: {
    padding: "10px 16px",
    background: "#8c4c4c",
    border: "1px solid #8c4c4c",
    borderRadius: "4px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursor: "pointer",
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "all 0.2s ease",
  },
};

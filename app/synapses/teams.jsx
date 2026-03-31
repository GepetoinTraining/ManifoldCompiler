"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const S = {
  container: {
    padding: 16, borderBottom: "1px solid #1a1a2e",
    background: "#0a0a0f",
  },
  title: {
    fontSize: 10, color: "#555", textTransform: "uppercase",
    letterSpacing: 1.5, marginBottom: 8, fontWeight: 600,
  },
  teamCard: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "8px 12px", background: "#0e0e14", border: "1px solid #1a1a2e",
    borderRadius: 4, marginBottom: 4, cursor: "pointer",
    transition: "border-color 0.2s",
  },
  teamName: { fontSize: 12, color: "#e8d5a3", fontWeight: 600 },
  teamMeta: { fontSize: 9, color: "#555" },
  leaderBadge: {
    fontSize: 8, color: "#c9a84c", background: "#1a1510",
    padding: "2px 6px", borderRadius: 3, border: "1px solid #4a3d1f",
  },
  createBtn: {
    width: "100%", background: "transparent", border: "1px dashed #1a1a2e",
    color: "#555", fontFamily: "inherit", fontSize: 10, padding: "8px",
    cursor: "pointer", borderRadius: 4, marginTop: 4,
    transition: "all 0.2s",
  },
  modal: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(5,5,16,0.9)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modalCard: {
    background: "#0a0a12", border: "1px solid #1a1a2e", borderRadius: 8,
    padding: 24, width: 340, maxWidth: "90vw",
  },
  modalTitle: { fontSize: 14, color: "#c9a84c", fontWeight: 700, marginBottom: 16 },
  input: {
    width: "100%", background: "#0e0e14", border: "1px solid #1a1a2e",
    color: "#e8d5a3", fontFamily: "inherit", fontSize: 11, padding: "8px 10px",
    borderRadius: 4, outline: "none", marginBottom: 8, boxSizing: "border-box",
  },
  submitBtn: {
    width: "100%", background: "#1a1510", border: "1px solid #4a3d1f",
    color: "#c9a84c", fontFamily: "inherit", fontSize: 11, padding: "8px",
    cursor: "pointer", borderRadius: 4, fontWeight: 600, marginTop: 4,
  },
  cancelBtn: {
    width: "100%", background: "transparent", border: "1px solid #1a1a2e",
    color: "#555", fontFamily: "inherit", fontSize: 10, padding: "6px",
    cursor: "pointer", borderRadius: 4, marginTop: 4,
  },
};

export default function TeamsPanel({ uuid }) {
  const [teams, setTeams] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!uuid) return;
    // Teams come from Turso (via big kernel sync) — graceful if unavailable
    fetch(`/api/proxy/team/list?uuid=${uuid}`)
      .then((r) => r.ok ? r.json() : { O: [] })
      .then((data) => {
        if (data.O && Array.isArray(data.O)) setTeams(data.O);
      })
      .catch(() => {});
  }, [uuid]);

  async function createTeam() {
    if (!name.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/proxy/team/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Torus-Key": localStorage.getItem("torus_api_key") || "",
        },
        body: JSON.stringify({
          name: name.trim(),
          leader_uuid: uuid,
          members: [],
        }),
      });
      const data = await res.json();

      if (data.O && data.O.id) {
        setTeams((prev) => [
          ...prev,
          { id: data.O.id, name: name.trim(), is_leader: true, member_count: 1 },
        ]);
        setName("");
        setShowCreate(false);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  return (
    <div style={S.container}>
      <div style={S.title}>Teams</div>

      {teams.length === 0 && !showCreate && (
        <div style={{ fontSize: 10, color: "#333", marginBottom: 8 }}>
          no teams yet
        </div>
      )}

      {teams.map((team) => (
        <div
          key={team.id}
          style={S.teamCard}
          onClick={() => router.push(`/workspace/${team.id}`)}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#c9a84c")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a2e")}
        >
          <div>
            <div style={S.teamName}>⬡ {team.name}</div>
            <div style={S.teamMeta}>
              {team.member_count} member{team.member_count !== 1 ? "s" : ""}
            </div>
          </div>
          {team.is_leader && <span style={S.leaderBadge}>★ leader</span>}
        </div>
      ))}

      {!showCreate ? (
        <button
          style={S.createBtn}
          onClick={() => setShowCreate(true)}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "#c9a84c";
            e.currentTarget.style.color = "#c9a84c";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "#1a1a2e";
            e.currentTarget.style.color = "#555";
          }}
        >
          + create team
        </button>
      ) : (
        <div style={S.modal} onClick={() => setShowCreate(false)}>
          <div style={S.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={S.modalTitle}>⬡ New Team</div>
            <input
              style={S.input}
              placeholder="team name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createTeam()}
              autoFocus
            />
            <button
              style={{ ...S.submitBtn, opacity: loading ? 0.5 : 1 }}
              onClick={createTeam}
              disabled={loading}
            >
              {loading ? "..." : "Create Workspace"}
            </button>
            <button style={S.cancelBtn} onClick={() => setShowCreate(false)}>
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

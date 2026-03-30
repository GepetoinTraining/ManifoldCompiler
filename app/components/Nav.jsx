"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function Nav() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const uuid = localStorage.getItem("torus_uuid");
    const name = localStorage.getItem("torus_name");
    if (uuid) {
      setLoggedIn(true);
      setUserName(name || "U");
    }
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleLogout() {
    localStorage.removeItem("torus_uuid");
    localStorage.removeItem("torus_name");
    localStorage.removeItem("torus_email");
    localStorage.removeItem("torus_profession");
    setLoggedIn(false);
    setDropdownOpen(false);
    router.push("/");
  }

  const initial = userName ? userName.charAt(0).toUpperCase() : "U";

  return (
    <nav style={styles.nav}>
      <Link href="/" style={styles.brand}>
        <span style={styles.icon}>⬡</span> Manifold Compiler
      </Link>

      {!loggedIn ? (
        <Link href="/synapses" style={styles.loginLink}>
          Log in
        </Link>
      ) : (
        <div ref={dropdownRef} style={styles.avatarWrap}>
          <button
            onClick={() => setDropdownOpen((p) => !p)}
            style={styles.avatar}
            aria-label="User menu"
          >
            {initial}
          </button>
          {dropdownOpen && (
            <div style={styles.dropdown}>
              <Link
                href="/synapses"
                style={styles.dropdownItem}
                onClick={() => setDropdownOpen(false)}
              >
                Synapses
              </Link>
              <Link
                href="/compiler"
                style={styles.dropdownItem}
                onClick={() => setDropdownOpen(false)}
              >
                Compiler
              </Link>
              <Link
                href="/settings"
                style={styles.dropdownItem}
                onClick={() => setDropdownOpen(false)}
              >
                Settings
              </Link>
              <div style={styles.dropdownDivider} />
              <button onClick={handleLogout} style={styles.dropdownLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
      )}
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    background: "#0a0a0c",
    borderBottom: "1px solid #1a1a2e",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  brand: {
    fontSize: "15px",
    fontWeight: 700,
    color: "#c9a84c",
    letterSpacing: "2px",
    textTransform: "uppercase",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  icon: {
    fontSize: "18px",
  },
  loginLink: {
    color: "#555",
    textDecoration: "none",
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "1px",
    textTransform: "uppercase",
    transition: "color 0.2s ease",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "transparent",
    border: "1px solid #c9a84c",
    color: "#c9a84c",
    fontSize: "13px",
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    minWidth: "160px",
    background: "#0a0a12",
    border: "1px solid #1a1a2e",
    borderRadius: "6px",
    padding: "6px 0",
    zIndex: 1000,
    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
  },
  dropdownItem: {
    display: "block",
    padding: "10px 16px",
    color: "#e8d5a3",
    fontSize: "11px",
    textDecoration: "none",
    letterSpacing: "0.5px",
    transition: "background 0.15s ease",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  dropdownDivider: {
    height: "1px",
    background: "#1a1a2e",
    margin: "4px 0",
  },
  dropdownLogout: {
    display: "block",
    width: "100%",
    padding: "10px 16px",
    background: "transparent",
    border: "none",
    color: "#8c4c4c",
    fontSize: "11px",
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    cursor: "pointer",
    textAlign: "left",
    letterSpacing: "0.5px",
    transition: "background 0.15s ease",
  },
};

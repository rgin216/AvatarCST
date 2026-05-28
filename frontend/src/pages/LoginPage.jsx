import { useState } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";

const SEED_MEMORIES = [
  { category: "personal",   content: "Has a daughter named Sarah who lives in Wellington", addedBy: "caregiver" },
  { category: "preference", content: "Loves gardening and growing roses", addedBy: "caregiver" },
  { category: "preference", content: "Favourite era: 1960s; likes The Beatles", addedBy: "caregiver" },
  { category: "preference", content: "Enjoys a cup of Earl Grey in the morning", addedBy: "caregiver" },
  { category: "personal",   content: "Grew up in Christchurch, moved to Auckland in 1978", addedBy: "caregiver" },
];

export default function LoginPage({ onLogin }) {
  const isDesktop = useIsDesktop();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/users/login/${encodeURIComponent(name.trim())}`);
      const { user, created } = data;
      if (created) {
        await Promise.all(SEED_MEMORIES.map(mem => api.post(`/memory/${user._id}/entries`, mem)));
      }
      onLogin(user._id, user.preferredName || user.name);
    } catch (err) {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, #EDD9C8 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px",
    }}>
      <div className="fade-up" style={{
        background: theme.white,
        borderRadius: 28,
        padding: isDesktop ? "56px 64px" : "40px 32px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 8px 48px rgba(139,107,90,0.12)",
        textAlign: "center",
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 600, color: theme.text, marginBottom: 6 }}>AvatarCST</div>
        <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 40 }}>Your therapy companion</div>

        <div style={{ fontSize: 26, marginBottom: 24 }}>👋</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text, marginBottom: 8 }}>Who's joining today?</div>
        <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 28 }}>Enter your name to continue</div>

        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleLogin()}
          placeholder="Your name..."
          style={{
            width: "100%", padding: "16px 20px", borderRadius: 16,
            border: `1.5px solid ${theme.blush}`, fontFamily: "'Nunito', sans-serif",
            fontSize: 18, color: theme.text, background: theme.cream,
            outline: "none", marginBottom: 16, boxSizing: "border-box", textAlign: "center",
          }}
        />

        {error && <div style={{ fontSize: 13, color: "#C0504D", marginBottom: 12 }}>{error}</div>}

        <button onClick={handleLogin} disabled={loading} className="btn-primary">
          {loading ? "Loading..." : "Continue →"}
        </button>
      </div>
    </div>
  );
}

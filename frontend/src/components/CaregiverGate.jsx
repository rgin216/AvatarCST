import { useState } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import { useLanguage } from "../language/useLanguage.js";

const inputStyle = {
  width: "100%", padding: "14px 18px", borderRadius: 16,
  border: `1.5px solid ${theme.mist}`, fontFamily: "'Nunito', sans-serif",
  fontSize: 18, color: theme.text, background: theme.cream,
  outline: "none", marginBottom: 14, boxSizing: "border-box",
};

// Asks for the account password each time the caregiver area is opened.
// The unlock lives in component state, so leaving the area or refreshing locks it again.
export default function CaregiverGate({ userId, userName, onBack, children }) {
  const { t } = useLanguage();
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (unlocked) return children;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !password) return;
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/users/${userId}/verify-password`, { password });
      setUnlocked(true);
    } catch (err) {
      setError(t(err.response?.status === 401 ? "caregiver.gate.wrong" : "caregiver.gate.error"));
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(160deg, #E8EDF5 0%, #FDF6EE 50%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "24px 16px",
    }}>
      <div className="fade-up" style={{
        background: theme.white, borderRadius: 28, padding: "36px 28px 32px",
        width: "100%", maxWidth: 420, boxShadow: "0 8px 48px rgba(122,157,173,0.18)",
        position: "relative", textAlign: "center",
      }}>
        <button onClick={onBack} aria-label="Back to home" title="Back to home" className="carousel-arrow"
          style={{ position: "absolute", top: 16, left: 16, width: 40, height: 40, fontSize: 18 }}>←</button>

        <div style={{ fontSize: 28, marginBottom: 12 }} aria-hidden="true">🔒</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text, margin: "0 0 8px" }}>
          {t("caregiver.gate.title")}
        </h1>

        <form onSubmit={handleSubmit} noValidate>
          <p style={{ fontSize: 15, color: theme.textLight, lineHeight: 1.55, margin: "0 0 20px" }}>
            {t("caregiver.gate.enterPrompt", { name: userName })}
          </p>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            aria-label={t("caregiver.gate.password")}
            placeholder={t("caregiver.gate.password")}
            autoComplete="current-password"
            autoFocus
            style={inputStyle}
          />
          {error && <div role="alert" style={{ fontSize: 14, color: "#C0504D", marginBottom: 14, lineHeight: 1.5 }}>{error}</div>}
          <button type="submit" disabled={submitting} className="btn-primary" style={{ padding: 16, fontSize: 18, opacity: submitting ? 0.7 : 1 }}>
            {t("caregiver.gate.unlock")}
          </button>
        </form>
      </div>
    </div>
  );
}

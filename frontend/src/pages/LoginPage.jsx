import { useState } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";

const MIN_PASSWORD_LENGTH = 4;
const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

const labelStyle = { display: "block", textAlign: "left", fontSize: 14, fontWeight: 700, color: theme.textLight, margin: "0 0 4px 4px" };
const inputStyle = {
  width: "100%", padding: "11px 16px", borderRadius: 14,
  border: `1.5px solid ${theme.blush}`, fontFamily: "'Nunito', sans-serif",
  fontSize: 17, color: theme.text, background: theme.cream,
  outline: "none", marginBottom: 12, boxSizing: "border-box",
};
const checkboxRowStyle = { display: "flex", alignItems: "center", gap: 10, fontSize: 15, color: theme.text, cursor: "pointer", userSelect: "none" };
const checkboxStyle = { width: 20, height: 20, accentColor: theme.sageDark, cursor: "pointer", margin: 0 };

export default function LoginPage({ onLogin }) {
  const isDesktop = useIsDesktop();
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isRegister = mode === "register";

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setPassword("");
  };

  const validate = () => {
    if (isRegister && !name.trim()) return "Please tell us what Aria should call you.";
    if (!username.trim()) return "Please enter your username.";
    if (!password) return "Please enter your password.";
    if (!isRegister) return "";
    if (!USERNAME_PATTERN.test(username.trim().toLowerCase())) return "Usernames need 3–30 letters or numbers (dots, dashes and underscores are fine too).";
    if (password.length < MIN_PASSWORD_LENGTH) return `Your password needs at least ${MIN_PASSWORD_LENGTH} characters.`;
    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const problem = validate();
    if (problem) { setError(problem); return; }
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = isRegister
        ? await api.post("/users/register", { name: name.trim(), username: username.trim(), password })
        : await api.post("/users/login", { username: username.trim(), password });
      onLogin(user._id, user.preferredName || user.name, rememberMe);
    } catch (err) {
      const status = err.response?.status;
      setError(status && status < 500 && err.response?.data?.error
        ? err.response.data.error
        : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, #EDD9C8 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "16px",
    }}>
      <div className="fade-up" style={{
        background: theme.white,
        borderRadius: 28,
        padding: isDesktop ? "36px 48px" : "28px 24px",
        width: "100%",
        maxWidth: 420,
        boxShadow: "0 8px 48px rgba(139,107,90,0.12)",
        textAlign: "center",
      }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 600, color: theme.text, marginBottom: 2 }}>AvatarCST</div>
        <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 20 }}>Your therapy companion</div>

        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text, marginBottom: 4 }}>
          {isRegister ? "Create an account" : "Welcome back"} <span aria-hidden="true">👋</span>
        </div>
        <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 18 }}>
          {isRegister ? "Set up a new profile for sessions with Aria" : "Sign in with your username and password"}
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {isRegister && (
            <>
              <label htmlFor="login-name" style={labelStyle}>What should Aria call you?</label>
              <input
                id="login-name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="given-name"
                autoCapitalize="words"
                placeholder="e.g. Margaret"
                style={inputStyle}
              />
            </>
          )}

          <label htmlFor="login-username" style={labelStyle}>Username</label>
          <input
            id="login-username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={isRegister ? "Pick a username..." : "Your username..."}
            style={inputStyle}
          />

          <label htmlFor="login-password" style={labelStyle}>Password</label>
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            placeholder="Your password..."
            style={inputStyle}
          />

          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "10px 16px", margin: "2px 4px 16px" }}>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} style={checkboxStyle} />
              Remember me
            </label>
            <label style={checkboxRowStyle}>
              <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} style={checkboxStyle} />
              Show password
            </label>
          </div>

          {error && <div role="alert" style={{ fontSize: 14, color: "#C0504D", marginBottom: 12, lineHeight: 1.4 }}>{error}</div>}

          <button type="submit" disabled={loading} className="btn-primary" style={{ padding: 16, fontSize: 18, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Please wait..." : isRegister ? "Create account →" : "Sign in →"}
          </button>
        </form>

        <div style={{ fontSize: 15, color: theme.textLight, marginTop: 14 }}>
          {isRegister ? "Already have an account?" : "New here?"}{" "}
          <button
            type="button"
            onClick={() => switchMode(isRegister ? "signin" : "register")}
            style={{ background: "none", border: "none", padding: 0, color: theme.mistDark, fontWeight: 700, fontSize: 15, fontFamily: "'Nunito', sans-serif", cursor: "pointer", textDecoration: "underline" }}
          >
            {isRegister ? "Sign in" : "Create an account"}
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";
import ActivityCard from "../components/ui/ActivityCard";

const activities = [
  { icon: "🧩", label: "Word Games", desc: "Puzzles & associations" },
  { icon: "🌿", label: "Reminiscence", desc: "Share your memories" },
  { icon: "🎶", label: "Music & Arts", desc: "Creative expression" },
  { icon: "🗞️", label: "Current Events", desc: "Chat about the world" },
];

export default function LandingPage({ onStart, onCaregiver, userName, userId, sessionOptions = [] }) {
  const isDesktop = useIsDesktop();
  const [lastSession, setLastSession] = useState(null);

  useEffect(() => {
    if (!userId) return;
    api.get(`/sessions/user/${userId}`)
      .then(({ data }) => { if (data.length > 0) setLastSession(data[0]); })
      .catch(() => {});
  }, [userId]);

  const formatLastSession = (s) => {
    if (!s) return null;
    const date = new Date(s.startedAt || s.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    let dayLabel;
    if (date.toDateString() === now.toDateString()) dayLabel = "Today";
    else if (date.toDateString() === yesterday.toDateString()) dayLabel = "Yesterday";
    else dayLabel = date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
    const dur = s.startedAt && s.endedAt
      ? ` · ${Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000)} mins`
      : "";
    return `${dayLabel}, ${time}${dur}`;
  };

  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, #EDD9C8 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${theme.blush}55 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 60, left: -60, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${theme.sage}44 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{
        maxWidth: isDesktop ? 1000 : 480,
        margin: "0 auto",
        padding: isDesktop ? "48px 56px 40px" : "48px 28px 40px",
        display: isDesktop ? "grid" : "block",
        gridTemplateColumns: isDesktop ? "1fr 1fr" : undefined,
        gridTemplateRows: isDesktop ? "auto 1fr" : undefined,
        columnGap: isDesktop ? 72 : undefined,
        alignItems: isDesktop ? "start" : undefined,
      }}>
        <div className="fade-up" style={{
          gridColumn: isDesktop ? "1 / -1" : undefined,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          marginBottom: isDesktop ? 56 : 48,
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 32 : 28, fontWeight: 600, color: theme.text }}>AvatarCST</div>
            <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Your therapy companion</div>
          </div>
          <button onClick={onCaregiver} className="btn-outline">👨‍👩‍👧 Caregiver</button>
        </div>

        <div>
          <div className="fade-up delay-1" style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 15, color: theme.textLight, fontWeight: 500, marginBottom: 4 }}>{timeOfDay()},</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 44 : 38, fontWeight: 600, color: theme.text, lineHeight: 1.15 }}>{userName} 🌸</div>
            <div style={{ marginTop: 12, fontSize: 17, color: theme.textLight, lineHeight: 1.6 }}>Ready for today's session?<br />It's a great day to exercise your mind.</div>
          </div>

          <div className="fade-up delay-2" style={{ background: theme.white, borderRadius: 20, padding: "20px 24px", marginBottom: isDesktop ? 0 : 28, boxShadow: "0 4px 24px rgba(139,107,90,0.08)", display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, background: `linear-gradient(135deg, ${theme.blush}, ${theme.rose})`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔥</div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>7-day streak!</div>
              <div style={{ fontSize: 14, color: theme.textLight, marginTop: 2 }}>You've attended every session this week</div>
            </div>
          </div>
        </div>

        <div>
          <div className="fade-up delay-3" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Choose a theme</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {activities.map((a) => <ActivityCard key={a.label} activity={a} />)}
            </div>
          </div>

          <div className="fade-up delay-4">
            <div style={{ display: "grid", gap: 10 }}>
              {(sessionOptions.length ? sessionOptions : [{ id: "cst_intro_reminiscence", label: "Session 1", title: "Introduction & Welcome" }]).map((session) => (
                <button
                  key={session.id}
                  onClick={() => onStart(session)}
                  className={session.id === "cst_intro_reminiscence" ? "btn-primary btn-float" : "btn-mist"}
                  style={{ width: "100%" }}
                >
                  {session.label}: {session.title}
                </button>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: theme.textLight }}>
              {lastSession ? `Last session: ${formatLastSession(lastSession)}` : "No sessions yet"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

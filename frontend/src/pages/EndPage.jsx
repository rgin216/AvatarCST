import { useState, useEffect } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";

const TONE_LABELS = { positive: "Happy", mixed: "Mixed", neutral: "Calm", low: "Low" };
const LEVEL_LABELS = { high: "High", medium: "Medium", low: "Low" };

export default function EndPage({ onHome, userName, sessionId }) {
  const isDesktop = useIsDesktop();
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    if (!sessionId) return;
    api.get(`/sessions/${sessionId}`).then(({ data }) => setSessionData(data)).catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) { setSummaryLoading(false); return; }
    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 8;

    const fetchSummary = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get(`/summaries/session/${sessionId}`);
        if (!cancelled) { setSummary(data); setSummaryLoading(false); }
        return;
      } catch (err) {
        if (err.response?.status !== 404) {
          if (!cancelled) setSummaryLoading(false);
          return;
        }
      }
      attempts++;
      if (!cancelled && attempts < MAX_ATTEMPTS) {
        setTimeout(fetchSummary, 2000);
      } else if (!cancelled) {
        setSummaryLoading(false);
      }
    };

    fetchSummary();
    return () => { cancelled = true; };
  }, [sessionId]);

  const highlights = summary?.keyTalkingPoints || [];

  const durationMins = sessionData?.startedAt && sessionData?.endedAt
    ? Math.round((new Date(sessionData.endedAt) - new Date(sessionData.startedAt)) / 60000)
    : null;
  const topicsCovered = sessionData?.scriptStepIndex ?? null;

  const stats = [
    { label: "Duration", value: durationMins != null ? `${durationMins} min` : "—", icon: "⏱️", chip: `linear-gradient(135deg, ${theme.sage}, ${theme.sageDark})` },
    { label: "Topics Covered", value: topicsCovered != null ? String(topicsCovered) : "—", icon: "💬", chip: `linear-gradient(135deg, ${theme.mist}, ${theme.mistDark})` },
    { label: "Engagement", value: summary ? (LEVEL_LABELS[summary.engagementLevel] || "—") : "—", icon: "⭐", chip: `linear-gradient(135deg, ${theme.blush}, ${theme.rose})` },
    { label: "Mood", value: summary ? (TONE_LABELS[summary.emotionalTone] || "—") : "—", icon: "😊", chip: `linear-gradient(135deg, ${theme.rose}, ${theme.warm})` },
  ];

  const contentMaxWidth = isDesktop ? 720 : 480;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.cream }}>
      <div style={{
        position: "relative", overflow: "hidden", flexShrink: 0,
        background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, ${theme.blush}30 100%)`,
        paddingBottom: isDesktop ? 48 : 36,
      }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${theme.blush}55 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "10%", left: -90, width: 240, height: 240, borderRadius: "50%", background: `radial-gradient(circle, ${theme.rose}30 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto", padding: isDesktop ? "36px 32px 0" : "32px 24px 0", position: "relative" }}>
          <div className="fade-up" style={{ textAlign: "center" }}>
            <div className="avatar-float" style={{ fontSize: 52, marginBottom: 10 }}>🌟</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 36 : 30, fontWeight: 700, color: theme.text }}>Great session, {userName}!</div>
            <div style={{ fontSize: 15, color: theme.textLight, marginTop: 6, lineHeight: 1.5 }}>You did wonderfully today. Keep up the wonderful work!</div>
          </div>
        </div>
      </div>

      <div style={{
        position: "relative", flex: 1,
        marginTop: isDesktop ? -28 : -18,
        background: `linear-gradient(180deg, ${theme.white} 0%, #E7EEF1 100%)`,
        borderRadius: isDesktop ? "36px 36px 0 0" : "24px 24px 0 0",
        boxShadow: "0 -14px 36px rgba(122,157,173,0.14)",
      }}>
        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto", padding: isDesktop ? "24px 32px 28px" : "20px 24px 24px" }}>
          <div className="fade-up delay-1" style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 10, marginBottom: 18 }}>
            {stats.map((s) => (
              <div key={s.label} style={{ background: theme.white, borderRadius: 18, padding: "14px 10px", textAlign: "center", boxShadow: "0 6px 20px rgba(139,107,90,0.08)" }}>
                <div style={{ width: 34, height: 34, margin: "0 auto 8px", borderRadius: 11, background: s.chip, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 19, fontWeight: 700, color: theme.text }}>{s.value}</div>
                <div style={{ fontSize: 11, color: theme.textLight, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div className="fade-up delay-2" style={{ background: theme.white, borderRadius: 20, padding: "16px 20px", marginBottom: 20, boxShadow: "0 6px 20px rgba(139,107,90,0.08)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Session Highlights</div>
            <div
              className="highlights-scroll"
              tabIndex={0}
              role="region"
              aria-label="Session highlights"
              style={{ maxHeight: isDesktop ? 230 : 190, overflowY: "auto", paddingRight: 4 }}
            >
              {summaryLoading && (
                <div style={{ fontSize: 14, color: theme.textLight }}>Generating highlights...</div>
              )}
              {!summaryLoading && highlights.length === 0 && (
                <div style={{ fontSize: 14, color: theme.textLight }}>No highlights available for this session.</div>
              )}
              {!summaryLoading && highlights.map((h, i, arr) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < arr.length - 1 ? 10 : 0, fontSize: 14, color: theme.text, lineHeight: 1.5 }}>
                  <span style={{ color: theme.sageDark, fontWeight: 700, marginTop: 1 }}>✓</span>{h}
                </div>
              ))}
            </div>
          </div>

          <div className="fade-up delay-3">
            <button onClick={onHome} className="btn-primary" style={{ padding: 16, fontSize: 17 }}>Finish Session</button>
          </div>
        </div>
      </div>
    </div>
  );
}

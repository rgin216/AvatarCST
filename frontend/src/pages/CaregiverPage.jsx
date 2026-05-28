import { useState, useEffect } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";

const CATEGORY_LABELS = {
  personal: "Personal",
  preference: "Preference",
  session_insight: "Insight",
  caregiver_note: "Note",
};

const CATEGORY_COLORS = {
  personal: "#B8CDD8",
  preference: "#F4C8B0",
  session_insight: "#A8C5A0",
  caregiver_note: "#F4C8B0",
};

export default function CaregiverPage({ userId, onBack, userName }) {
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState("summary");
  const [memories, setMemories] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState("personal");
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionMessages, setSessionMessages] = useState({});

  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "memory", label: "Memory Bank" },
    { id: "history", label: "History" },
  ];

  useEffect(() => {
    if (!userId) return;
    api.get(`/memory/${userId}`)
      .then(({ data }) => setMemories(data.entries || []))
      .catch(() => {})
      .finally(() => setLoadingMemory(false));

    api.get(`/sessions/user/${userId}`)
      .then(({ data }) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));
  }, [userId]);

  const addMemory = async () => {
    if (!newMemoryText.trim() || !userId) return;
    try {
      const { data } = await api.post(`/memory/${userId}/entries`, {
        category: newMemoryCategory,
        content: newMemoryText.trim(),
        addedBy: "caregiver",
      });
      setMemories(data.entries || []);
      setNewMemoryText("");
      setAddingMemory(false);
    } catch (err) {
      console.error("Failed to add memory", err);
    }
  };

  const deleteMemory = async (entryId) => {
    try {
      const { data } = await api.delete(`/memory/${userId}/entries/${entryId}`);
      setMemories(data.entries || []);
    } catch (err) {
      console.error("Failed to delete memory", err);
    }
  };

  const formatSessionDate = (session) => {
    const date = new Date(session.startedAt || session.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
  };

  const toggleSession = async (sessionId) => {
    if (expandedSessionId === sessionId) {
      setExpandedSessionId(null);
      return;
    }
    setExpandedSessionId(sessionId);
    if (sessionMessages[sessionId]) return;
    try {
      const { data } = await api.get(`/sessions/${sessionId}/messages`);
      setSessionMessages(prev => ({ ...prev, [sessionId]: data }));
    } catch {
      setSessionMessages(prev => ({ ...prev, [sessionId]: [] }));
    }
  };

  const formatDuration = (session) => {
    if (!session.startedAt || !session.endedAt) return "—";
    const mins = Math.round((new Date(session.endedAt) - new Date(session.startedAt)) / 60000);
    return `${mins} min`;
  };

  const tabContent = (
    <>
      {tab === "summary" && (
        <div className="fade-up">
          <div style={{ background: theme.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Latest Session</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              {[
                { label: "Emotional State", value: "Positive 😊", color: "#A8C5A0" },
                { label: "Engagement", value: "High ⭐", color: "#F4C8B0" },
                { label: "Cognitive Score", value: "78 / 100", color: "#B8CDD8" },
              ].map(s => (
                <div key={s.label} style={{ flex: "1 1 120px", background: s.color + "33", borderRadius: 14, padding: "14px" }}>
                  <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: theme.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>Important Talking Points</div>
            {["Mentioned missing her late husband's garden", "Expressed interest in visiting Christchurch again", "Recalled visiting the beach in summer 1972"].map((p, i, arr) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: i < arr.length - 1 ? 12 : 0, fontSize: 15, color: theme.text, lineHeight: 1.5 }}>
                <span style={{ color: theme.mistDark, fontWeight: 700 }}>•</span> {p}
              </div>
            ))}
          </div>
          <div style={{ background: "#FFF3E8", borderRadius: 16, padding: "16px 18px", borderLeft: `4px solid ${theme.blush}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: theme.warm, marginBottom: 4 }}>⚠ Note for caregiver</div>
            <div style={{ fontSize: 14, color: theme.textLight, lineHeight: 1.5 }}>{userName} appeared briefly sad when discussing her late husband. Consider checking in on her mood today.</div>
          </div>
        </div>
      )}

      {tab === "memory" && (
        <div className="fade-up">
          <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 16, lineHeight: 1.6 }}>These are memories Aria uses to personalise sessions for {userName}. Add or remove them below.</div>
          {loadingMemory && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight }}>Loading memories...</div>}
          {!loadingMemory && memories.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight, fontSize: 15 }}>No memories yet. Add one below.</div>}
          {memories.map((m) => (
            <div key={m._id} style={{ background: theme.white, borderRadius: 16, padding: "16px 18px", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
              <span style={{ background: (CATEGORY_COLORS[m.category] || "#B8CDD8") + "55", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: theme.mistDark, flexShrink: 0, marginTop: 2 }}>
                {CATEGORY_LABELS[m.category] || m.category}
              </span>
              <span style={{ fontSize: 15, color: theme.text, flex: 1, lineHeight: 1.5 }}>{m.content}</span>
              <button onClick={() => deleteMemory(m._id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: theme.textLight, flexShrink: 0 }}>🗑️</button>
            </div>
          ))}
          {addingMemory ? (
            <div style={{ background: theme.white, borderRadius: 16, padding: "16px 18px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
              <select value={newMemoryCategory} onChange={e => setNewMemoryCategory(e.target.value)} style={{ width: "100%", marginBottom: 10, padding: "8px 12px", borderRadius: 10, border: `1px solid ${theme.blush}`, fontFamily: "'Nunito', sans-serif", fontSize: 14, color: theme.text, background: theme.cream, outline: "none" }}>
                <option value="personal">Personal</option>
                <option value="preference">Preference</option>
                <option value="caregiver_note">Caregiver Note</option>
              </select>
              <textarea value={newMemoryText} onChange={e => setNewMemoryText(e.target.value)} placeholder={`Enter a memory or fact about ${userName}...`} rows={3} style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: `1px solid ${theme.blush}`, fontFamily: "'Nunito', sans-serif", fontSize: 15, color: theme.text, background: theme.cream, outline: "none", resize: "none", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={addMemory} className="btn-primary" style={{ flex: 2, padding: "10px" }}>Save</button>
                <button onClick={() => { setAddingMemory(false); setNewMemoryText(""); }} className="btn-outline" style={{ flex: 1, padding: "10px" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingMemory(true)} className="btn-mist" style={{ width: "100%", marginTop: 8 }}>+ Add Memory</button>
          )}
        </div>
      )}

      {tab === "history" && (
        <div className="fade-up">
          {sessions.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
              <button onClick={async () => {
                if (!window.confirm("Clear all session history? This cannot be undone.")) return;
                await api.delete(`/sessions/user/${userId}`);
                setSessions([]);
                setExpandedSessionId(null);
                setSessionMessages({});
              }} style={{ background: "none", border: `1.5px solid #E8A09088`, borderRadius: 12, padding: "7px 14px", fontSize: 13, color: "#C0504D", cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}>
                🗑 Clear History
              </button>
            </div>
          )}
          {loadingHistory && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight }}>Loading history...</div>}
          {!loadingHistory && sessions.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight, fontSize: 15 }}>No sessions yet. Start a session to see history here.</div>}
          {sessions.map((s) => {
            const isExpanded = expandedSessionId === s._id;
            const messages = sessionMessages[s._id];
            return (
              <div key={s._id} style={{ background: theme.white, borderRadius: 18, marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)", overflow: "hidden" }}>
                <button onClick={() => toggleSession(s._id)} style={{ width: "100%", background: "none", border: "none", padding: "18px", cursor: "pointer", textAlign: "left", fontFamily: "'Nunito', sans-serif" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{formatSessionDate(s)}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8, background: s.status === "completed" ? "#A8C5A033" : "#F4C8B055", color: s.status === "completed" ? theme.sageDark : theme.warm }}>{s.status}</span>
                      <span style={{ fontSize: 12, color: theme.textLight }}>{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ fontSize: 13, color: theme.textLight }}>⏱ {formatDuration(s)}</div>
                    {s.theme && <div style={{ fontSize: 13, color: theme.textLight }}>🗣 {s.theme}</div>}
                  </div>
                </button>

                {isExpanded && (
                  <div style={{ borderTop: `1px solid ${theme.blush}44`, padding: "16px 18px", background: theme.cream }}>
                    {!messages && (
                      <div style={{ textAlign: "center", padding: "12px 0", color: theme.textLight, fontSize: 13 }}>Loading...</div>
                    )}
                    {messages && messages.length === 0 && (
                      <div style={{ textAlign: "center", padding: "12px 0", color: theme.textLight, fontSize: 13 }}>No messages recorded for this session.</div>
                    )}
                    {messages && messages.map((m, i) => (
                      <div key={i} style={{ display: "flex", flexDirection: m.role === "user" ? "row-reverse" : "row", gap: 8, marginBottom: 10, alignItems: "flex-start" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: theme.textLight, flexShrink: 0, marginTop: 4, minWidth: 44, textAlign: m.role === "user" ? "right" : "left" }}>
                          {m.role === "user" ? userName : "Aria"}
                        </div>
                        <div style={{
                          maxWidth: "75%", padding: "10px 14px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                          background: m.role === "user" ? `linear-gradient(135deg, ${theme.sage}55, ${theme.sageDark}33)` : theme.white,
                          fontSize: 14, color: theme.text, lineHeight: 1.5,
                          boxShadow: "0 1px 6px rgba(0,0,0,0.05)",
                        }}>
                          {m.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, #E8EDF5 0%, #FDF6EE 50%)`,
      display: isDesktop ? "grid" : "block",
      gridTemplateColumns: isDesktop ? "220px 1fr" : undefined,
      gridTemplateRows: isDesktop ? "auto 1fr" : undefined,
      maxWidth: isDesktop ? "none" : 480,
      margin: isDesktop ? 0 : "0 auto",
    }}>
      <div style={{ gridColumn: isDesktop ? "1 / -1" : undefined, padding: isDesktop ? "24px 32px 0" : "24px 24px 0", background: "linear-gradient(135deg, #B8CDD866, #7A9DAD33)", borderBottom: "1px solid #B8CDD888" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isDesktop ? 20 : 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>←</button>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text }}>Caregiver View</div>
            <div style={{ fontSize: 13, color: theme.textLight }}>{userName}'s profile</div>
          </div>
        </div>
        {!isDesktop && (
          <div style={{ display: "flex" }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                flex: 1, background: "none", border: "none", padding: "10px 0 14px", fontSize: 14,
                fontWeight: tab === t.id ? 700 : 500,
                color: tab === t.id ? theme.mistDark : theme.textLight,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                borderBottom: `3px solid ${tab === t.id ? theme.mistDark : "transparent"}`,
                transition: "all 0.2s",
              }}>{t.label}</button>
            ))}
          </div>
        )}
        {isDesktop && <div style={{ height: 20 }} />}
      </div>

      {isDesktop && (
        <div style={{ borderRight: "1px solid #B8CDD888", padding: "32px 0", background: "#F8F2EC" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "14px 28px", background: tab === t.id ? "#B8CDD822" : "none", border: "none",
              borderRight: `3px solid ${tab === t.id ? theme.mistDark : "transparent"}`,
              fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? theme.mistDark : theme.textLight,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontSize: 15,
              transition: "all 0.15s",
            }}>{t.label}</button>
          ))}
        </div>
      )}

      <div style={{ padding: isDesktop ? "32px 40px" : "24px", overflowY: isDesktop ? "auto" : undefined }}>
        {tabContent}
      </div>
    </div>
  );
}

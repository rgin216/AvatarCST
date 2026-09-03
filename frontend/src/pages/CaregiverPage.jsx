import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";
import { useLanguage } from "../language/useLanguage.js";
import { toneLabel, levelLabel } from "../language/summaryLabels.js";

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

const CAREGIVER_TAB_IDS = new Set(["summary", "memory", "history"]);

export default function CaregiverPage({ userId, onBack, onLogout, userName }) {
  const isDesktop = useIsDesktop();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const CAREGIVER_TABS = [
    { id: "summary", label: t("caregiver.tab.summary") },
    { id: "memory", label: t("caregiver.tab.memory") },
    { id: "history", label: t("caregiver.tab.history") },
  ];
  const { tab: tabParam } = useParams();
  const tab = CAREGIVER_TAB_IDS.has(tabParam) ? tabParam : "summary";
  const setTab = (id) => navigate(`/caregiver/${id}`, { replace: true });
  const [memories, setMemories] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loadingMemory, setLoadingMemory] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [addingMemory, setAddingMemory] = useState(false);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState("personal");
  const [expandedSessionId, setExpandedSessionId] = useState(null);
  const [sessionMessages, setSessionMessages] = useState({});
  const [sessionSummaries, setSessionSummaries] = useState({});
  const [expandedSummaryId, setExpandedSummaryId] = useState(null);
  const [savingPoints, setSavingPoints] = useState(new Set());
  const [latestSummary, setLatestSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const tabs = CAREGIVER_TABS;

  useEffect(() => {
    if (tabParam && !CAREGIVER_TAB_IDS.has(tabParam)) {
      navigate("/caregiver/summary", { replace: true });
    }
  }, [tabParam, navigate]);

  useEffect(() => {
    if (!userId) return;
    setMemories([]);
    setSessions([]);
    setExpandedSessionId(null);
    setSessionMessages({});
    setSessionSummaries({});
    setExpandedSummaryId(null);
    setLatestSummary(null);
    setLoadingMemory(true);
    setLoadingHistory(true);
    setLoadingSummary(true);
    api.get(`/memory/${userId}`)
      .then(({ data }) => setMemories(data.entries || []))
      .catch(() => {})
      .finally(() => setLoadingMemory(false));

    api.get(`/sessions/user/${userId}`)
      .then(({ data }) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoadingHistory(false));

    api.get(`/summaries/user/${userId}`)
      .then(({ data }) => setLatestSummary(data[0] || null))
      .catch(() => {})
      .finally(() => setLoadingSummary(false));
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

  const reviewMemory = async (entryId, status) => {
    try {
      const { data } = await api.patch(`/memory/${userId}/entries/${entryId}/review`, { status });
      setMemories(data.entries || []);
    } catch (err) {
      console.error("Failed to review memory", err);
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

  const approvedMemories = memories.filter((memory) => (memory.status || "approved") === "approved");
  const pendingMemories = memories.filter((memory) => memory.status === "pending");

  const formatSessionDate = (session) => {
    const date = new Date(session.startedAt || session.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return t("common.today");
    if (date.toDateString() === yesterday.toDateString()) return t("common.yesterday");
    return date.toLocaleDateString(language, { weekday: "short", day: "numeric", month: "short" });
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

  const toggleSummary = async (sessionId) => {
    if (expandedSummaryId === sessionId) { setExpandedSummaryId(null); return; }
    setExpandedSummaryId(sessionId);
    if (sessionSummaries[sessionId] !== undefined) return;
    setSessionSummaries(prev => ({ ...prev, [sessionId]: 'loading' }));
    try {
      const { data } = await api.get(`/summaries/session/${sessionId}`);
      setSessionSummaries(prev => ({ ...prev, [sessionId]: data }));
    } catch {
      setSessionSummaries(prev => ({ ...prev, [sessionId]: null }));
    }
  };

  const isPointSaved = (point) => memories.some((m) => m.content === point && m.status !== 'rejected');

  const addPointToMemory = async (point) => {
    if (!userId || isPointSaved(point) || savingPoints.has(point)) return;
    setSavingPoints((prev) => new Set(prev).add(point));
    try {
      const { data } = await api.post(`/memory/${userId}/entries`, {
        category: 'session_insight',
        content: point,
        addedBy: 'session',
      });
      setMemories(data.entries || []);
    } catch (err) {
      console.error('Failed to add memory', err);
    } finally {
      setSavingPoints((prev) => { const next = new Set(prev); next.delete(point); return next; });
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
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>{t("caregiver.latestSession")}</div>
            {loadingSummary && <div style={{ fontSize: 14, color: theme.textLight }}>{t("caregiver.loading")}</div>}
            {!loadingSummary && !latestSummary && <div style={{ fontSize: 14, color: theme.textLight }}>{t("caregiver.noSessionData")}</div>}
            {!loadingSummary && latestSummary && (() => {
              const stats = [
                { label: t("caregiver.stat.mood"), value: toneLabel(t, latestSummary.emotionalTone), color: "#A8C5A0" },
                { label: t("caregiver.stat.engagement"), value: levelLabel(t, latestSummary.engagementLevel), color: "#F4C8B0" },
                { label: t("caregiver.stat.score"), value: levelLabel(t, latestSummary.sessionScore), color: "#B8CDD8" },
              ];
              return (
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {stats.map(s => (
                    <div key={s.label} style={{ flex: "1 1 120px", background: s.color + "33", borderRadius: 14, padding: "14px" }}>
                      <div style={{ fontSize: 11, color: theme.textLight, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{s.value}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
          <div style={{ background: theme.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>{t("caregiver.talkingPoints")}</div>
            {loadingSummary && (
              <div style={{ fontSize: 14, color: theme.textLight }}>{t("caregiver.generatingSummary")}</div>
            )}
            {!loadingSummary && (!latestSummary || !latestSummary.keyTalkingPoints?.length) && (
              <div style={{ fontSize: 14, color: theme.textLight }}>{t("caregiver.noSummaryYet")}</div>
            )}
            {!loadingSummary && latestSummary?.keyTalkingPoints?.map((p, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: i < arr.length - 1 ? 12 : 0 }}>
                <div style={{ display: "flex", gap: 10, flex: 1, fontSize: 15, color: theme.text, lineHeight: 1.5 }}>
                  <span style={{ color: theme.mistDark, fontWeight: 700 }}>•</span> {p}
                </div>
                <button
                  onClick={() => addPointToMemory(p)}
                  disabled={isPointSaved(p)}
                  style={{ flexShrink: 0, background: isPointSaved(p) ? theme.sage + "44" : "none", border: `1.5px solid ${isPointSaved(p) ? theme.sageDark : theme.blush}`, borderRadius: 10, padding: "4px 10px", fontSize: 12, fontWeight: 600, color: isPointSaved(p) ? theme.sageDark : theme.textLight, cursor: isPointSaved(p) ? "default" : "pointer", fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap" }}
                >
                  {isPointSaved(p) ? "✓ Saved" : "+ Memory"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "memory" && (
        <div className="fade-up">
          <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 16, lineHeight: 1.6 }}>Approved memories are the only ones Aria uses to personalise sessions for {userName}. Review suggested memories before they become active.</div>
          {loadingMemory && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight }}>{t("caregiver.loadingMemories")}</div>}
          {!loadingMemory && pendingMemories.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{t("caregiver.reviewSuggested")}</div>
              {pendingMemories.map((m) => (
                <div key={m._id} style={{ background: "#FFF8EE", border: `1px solid ${theme.blush}88`, borderRadius: 16, padding: "16px 18px", marginBottom: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <span style={{ background: (CATEGORY_COLORS[m.category] || "#B8CDD8") + "55", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: theme.mistDark, flexShrink: 0, marginTop: 2 }}>
                      {CATEGORY_LABELS[m.category] || m.category}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, color: theme.text, lineHeight: 1.5 }}>{m.content}</div>
                      {m.reason && <div style={{ fontSize: 12, color: theme.textLight, marginTop: 6 }}>{m.reason}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button onClick={() => reviewMemory(m._id, "approved")} className="btn-primary" style={{ flex: 1, padding: "9px" }}>{t("caregiver.approve")}</button>
                    <button onClick={() => reviewMemory(m._id, "rejected")} className="btn-outline" style={{ flex: 1, padding: "9px" }}>{t("caregiver.reject")}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loadingMemory && approvedMemories.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight, fontSize: 15 }}>{t("caregiver.noApprovedMemories")}</div>}
          {approvedMemories.map((m) => (
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
                <button onClick={addMemory} className="btn-primary" style={{ flex: 2, padding: "10px" }}>{t("caregiver.save")}</button>
                <button onClick={() => { setAddingMemory(false); setNewMemoryText(""); }} className="btn-outline" style={{ flex: 1, padding: "10px" }}>{t("caregiver.cancel")}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingMemory(true)} className="btn-mist" style={{ width: "100%", marginTop: 8 }}>{t("caregiver.addMemory")}</button>
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
                {t("caregiver.clearHistory")}
              </button>
            </div>
          )}
          {loadingHistory && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight }}>{t("caregiver.loadingHistory")}</div>}
          {!loadingHistory && sessions.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: theme.textLight, fontSize: 15 }}>{t("caregiver.noSessionsYet")}</div>}
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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", gap: 16 }}>
                      <div style={{ fontSize: 13, color: theme.textLight }}>⏱ {formatDuration(s)}</div>
                      {s.theme && <div style={{ fontSize: 13, color: theme.textLight }}>🗣 {s.theme}</div>}
                    </div>
                    {s.status === "completed" && (
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => { e.stopPropagation(); toggleSummary(s._id); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); toggleSummary(s._id); } }}
                        style={{ background: "none", border: `1.5px solid ${theme.blush}`, borderRadius: 10, padding: "4px 12px", fontSize: 12, fontWeight: 600, color: theme.mistDark, cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
                      >
                        {expandedSummaryId === s._id ? t("caregiver.hideSummary") : t("caregiver.viewSummary")}
                      </div>
                    )}
                  </div>
                </button>

                {expandedSummaryId === s._id && (() => {
                  const sum = sessionSummaries[s._id];
                  const points = sum && sum !== 'loading' ? (sum.keyTalkingPoints || []) : [];
                  return (
                    <div style={{ borderTop: `1px solid ${theme.blush}44`, padding: "16px 18px", background: "#FFF8F2" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{t("caregiver.sessionSummary")}</div>
                      {sum === 'loading' && <div style={{ fontSize: 13, color: theme.textLight }}>{t("caregiver.loading")}</div>}
                      {sum !== 'loading' && points.length === 0 && <div style={{ fontSize: 13, color: theme.textLight }}>{t("caregiver.noSummaryForSession")}</div>}
                      {points.map((p, i, arr) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: i < arr.length - 1 ? 10 : 0 }}>
                          <div style={{ display: "flex", gap: 8, flex: 1, fontSize: 14, color: theme.text, lineHeight: 1.5 }}>
                            <span style={{ color: theme.mistDark, fontWeight: 700 }}>•</span> {p}
                          </div>
                          <button
                            onClick={() => addPointToMemory(p)}
                            disabled={isPointSaved(p)}
                            style={{ flexShrink: 0, background: isPointSaved(p) ? theme.sage + "44" : "none", border: `1.5px solid ${isPointSaved(p) ? theme.sageDark : theme.blush}`, borderRadius: 10, padding: "3px 10px", fontSize: 11, fontWeight: 600, color: isPointSaved(p) ? theme.sageDark : theme.textLight, cursor: isPointSaved(p) ? "default" : "pointer", fontFamily: "'Nunito', sans-serif", whiteSpace: "nowrap" }}
                          >
                            {isPointSaved(p) ? "✓ Saved" : "+ Memory"}
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

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
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text }}>{t("caregiver.title")}</div>
            <div style={{ fontSize: 13, color: theme.textLight }}>{t("caregiver.profileSubtitle", { name: userName })}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              style={{ background: "none", border: `1.5px solid ${theme.mistDark}88`, borderRadius: 12, padding: "7px 14px", fontSize: 13, color: theme.mistDark, cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontWeight: 600 }}
            >
              {t("caregiver.signOut")}
            </button>
          )}
        </div>
        {!isDesktop && (
          <div style={{ display: "flex" }}>
            {tabs.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                flex: 1, background: "none", border: "none", padding: "10px 0 14px", fontSize: 14,
                fontWeight: tab === tb.id ? 700 : 500,
                color: tab === tb.id ? theme.mistDark : theme.textLight,
                cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                borderBottom: `3px solid ${tab === tb.id ? theme.mistDark : "transparent"}`,
                transition: "all 0.2s",
              }}>{tb.label}</button>
            ))}
          </div>
        )}
        {isDesktop && <div style={{ height: 20 }} />}
      </div>

      {isDesktop && (
        <div style={{ borderRight: "1px solid #B8CDD888", padding: "32px 0", background: "#F8F2EC" }}>
          {tabs.map(tb => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "14px 28px", background: tab === tb.id ? "#B8CDD822" : "none", border: "none",
              borderRight: `3px solid ${tab === tb.id ? theme.mistDark : "transparent"}`,
              fontWeight: tab === tb.id ? 700 : 500,
              color: tab === tb.id ? theme.mistDark : theme.textLight,
              cursor: "pointer", fontFamily: "'Nunito', sans-serif", fontSize: 15,
              transition: "all 0.15s",
            }}>{tb.label}</button>
          ))}
        </div>
      )}

      <div style={{ padding: isDesktop ? "32px 40px" : "24px", overflowY: isDesktop ? "auto" : undefined }}>
        {tabContent}
      </div>
    </div>
  );
}

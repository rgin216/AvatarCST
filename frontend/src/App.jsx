import { useState, useEffect, useRef } from "react";
import { createDemoSession, demoUserId, respondToSession } from "./services/sessionApi";

const SCREENS = { LANDING: "landing", SESSION: "session", END: "end", CAREGIVER: "caregiver" };

const theme = {
  cream: "#FDF6EE",
  sand: "#F2E8D9",
  blush: "#F4C8B0",
  rose: "#E8A090",
  sage: "#A8C5A0",
  sageDark: "#7AAB72",
  mist: "#B8CDD8",
  mistDark: "#7A9DAD",
  warm: "#8B6B5A",
  text: "#3D2B1F",
  textLight: "#7A5C4A",
  white: "#FFFAF5",
};

function LandingScreen({ onStart, onCaregiver }) {
  const userName = "Margaret";
  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const activities = [
    { icon: "🧩", label: "Word Games", desc: "Puzzles & associations" },
    { icon: "🌿", label: "Reminiscence", desc: "Share your memories" },
    { icon: "🎶", label: "Music & Arts", desc: "Creative expression" },
    { icon: "🗞️", label: "Current Events", desc: "Chat about the world" },
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, #EDD9C8 100%)`,
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${theme.blush}55 0%, transparent 70%)`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: 60, left: -60, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${theme.sage}44 0%, transparent 70%)`, pointerEvents: "none" }} />

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 28px 40px" }}>
        <div className="fade-up" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 600, color: theme.text }}>AvatarCST</div>
            <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Your therapy companion</div>
          </div>
          <button onClick={onCaregiver} className="btn-outline">👨‍👩‍👧 Caregiver</button>
        </div>

        <div className="fade-up delay-1" style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 15, color: theme.textLight, fontWeight: 500, marginBottom: 4 }}>{timeOfDay()},</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 38, fontWeight: 600, color: theme.text, lineHeight: 1.15 }}>{userName} 🌸</div>
          <div style={{ marginTop: 12, fontSize: 17, color: theme.textLight, lineHeight: 1.6 }}>Ready for today's session?<br />It's a great day to exercise your mind.</div>
        </div>

        <div className="fade-up delay-2" style={{ background: theme.white, borderRadius: 20, padding: "20px 24px", marginBottom: 28, boxShadow: "0 4px 24px rgba(139,107,90,0.08)", display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 52, height: 52, background: `linear-gradient(135deg, ${theme.blush}, ${theme.rose})`, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🔥</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>7-day streak!</div>
            <div style={{ fontSize: 14, color: theme.textLight, marginTop: 2 }}>You've attended every session this week</div>
          </div>
        </div>

        <div className="fade-up delay-3" style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>Choose a theme</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {activities.map((a) => <ActivityCard key={a.label} activity={a} />)}
          </div>
        </div>

        <div className="fade-up delay-4">
          <button onClick={onStart} className="btn-primary btn-float">▶ Start Session</button>
          <div style={{ textAlign: "center", marginTop: 12, fontSize: 13, color: theme.textLight }}>Last session: Yesterday, 2:30 PM · 18 mins</div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity }) {
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => setActive(!active)} style={{
      background: active ? `linear-gradient(135deg, ${theme.blush}88, ${theme.rose}55)` : theme.white,
      border: `2px solid ${active ? theme.rose : "transparent"}`,
      borderRadius: 18, padding: "18px 14px", cursor: "pointer", textAlign: "left",
      fontFamily: "'Nunito', sans-serif",
      boxShadow: active ? `0 4px 20px ${theme.rose}33` : "0 2px 12px rgba(139,107,90,0.07)",
      transition: "all 0.2s",
    }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{activity.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{activity.label}</div>
      <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{activity.desc}</div>
    </button>
  );
}

function SessionScreen({ onEnd }) {
  const [messages, setMessages] = useState([
    { from: "avatar", text: "Hello Margaret! Lovely to see you today. How are you feeling this afternoon? 😊" },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [apiMode, setApiMode] = useState(demoUserId ? "connecting" : "offline");
  const [activeSlide, setActiveSlide] = useState({
    title: "Welcome",
    prompt: "A gentle check-in to begin the session.",
    visualHint: "Warm living room, tea, calm daylight",
  });
  const [memorySuggestions, setMemorySuggestions] = useState([]);
  const scrollRef = useRef(null);
  const replyIndex = useRef(0);
  const bootStarted = useRef(false);

  const avatarReplies = [
    "That's wonderful to hear! Let's start with a little word game. I'll say a word, and you tell me the first thing that comes to mind. Ready? 🌈 Rainbow!",
    "Lovely! Speaking of colours, do you have a favourite colour that reminds you of a special memory?",
    "How beautiful! You have such a vivid memory. Tell me more about that time — what was the weather like?",
    "That sounds absolutely lovely. Shall we try a music round next? 🎵",
  ];

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    let cancelled = false;

    const startBackendSession = async () => {
      if (!demoUserId) return;
      if (bootStarted.current) return;
      bootStarted.current = true;
      try {
        const session = await createDemoSession("Reminiscence");
        const turn = await respondToSession(session._id, "");
        if (cancelled) return;
        setSessionId(session._id);
        setApiMode("connected");
        setActiveSlide(turn.slide);
        setMessages([{ from: "avatar", text: turn.assistantText }]);
      } catch (err) {
        console.warn("Falling back to local session script:", err);
        if (!cancelled) setApiMode("offline");
      }
    };

    startBackendSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyBackendTurn = (turn) => {
    setActiveSlide(turn.slide);
    setMemorySuggestions(turn.suggestedMemoryUpdates || []);
    setMessages(m => [...m, { from: "avatar", text: turn.assistantText }]);
  };

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { from: "user", text }]);
    setInput("");
    setTyping(true);

    if (sessionId && apiMode === "connected") {
      try {
        const turn = await respondToSession(sessionId, text);
        applyBackendTurn(turn);
      } catch (err) {
        console.warn("Backend session turn failed, using local reply:", err);
        setApiMode("offline");
        setMessages(m => [...m, { from: "avatar", text: avatarReplies[replyIndex.current++ % avatarReplies.length] }]);
      } finally {
        setTyping(false);
      }
      return;
    }

    setTimeout(() => {
      setTyping(false);
      setMessages(m => [...m, { from: "avatar", text: avatarReplies[replyIndex.current++ % avatarReplies.length] }]);
    }, 900);
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #E8D5C4 0%, ${theme.cream} 40%)`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.blush}55`, background: theme.white + "CC", backdropFilter: "blur(12px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{apiMode === "connected" ? "Guided CST session" : "Local session preview"}</span>
        </div>
        <div style={{ fontSize: 13, color: theme.textLight }}>Reminiscence · 0:04</div>
        <button onClick={onEnd} style={{ background: "#FDE8E8", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 13, color: "#C0504D", cursor: "pointer", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>End</button>
      </div>

      <div style={{ padding: "20px 20px 0" }}>
        <div style={{ background: "linear-gradient(135deg, #FFFAF5, #EAF2ED)", border: `1px solid ${theme.sage}66`, borderRadius: 18, padding: "18px 20px", boxShadow: "0 4px 22px rgba(139,107,90,0.08)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text }}>{activeSlide.title}</div>
              <div style={{ fontSize: 15, color: theme.textLight, lineHeight: 1.45, marginTop: 6 }}>{activeSlide.prompt}</div>
            </div>
            {activeSlide.total && <div style={{ fontSize: 12, fontWeight: 700, color: theme.sageDark, background: "#FFFFFFAA", borderRadius: 10, padding: "6px 9px", flexShrink: 0 }}>{activeSlide.index + 1}/{activeSlide.total}</div>}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: theme.textLight }}>{activeSlide.visualHint}</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "18px 24px 12px" }}>
        <div style={{ position: "relative", width: 130, height: 130 }}>
          {listening && [0, 0.4, 0.8].map((d, i) => (
            <div key={i} className="ripple-ring" style={{ animationDelay: `${d}s` }} />
          ))}
          <div className="avatar-float" style={{ width: 130, height: 130, borderRadius: "50%", background: `linear-gradient(145deg, ${theme.blush}, #D4A882)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, boxShadow: `0 8px 40px ${theme.blush}88`, position: "relative", zIndex: 1 }}>🧓</div>
        </div>
        <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: theme.text, fontFamily: "'Playfair Display', serif" }}>Aria</div>
        <div style={{ fontSize: 12, color: theme.textLight }}>Your therapy companion</div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "8px 20px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((m, i) => (
          <div key={i} className="slide-in" style={{ display: "flex", justifyContent: m.from === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "78%", background: m.from === "avatar" ? theme.white : `linear-gradient(135deg, ${theme.sage}, ${theme.sageDark})`, color: m.from === "avatar" ? theme.text : theme.white, borderRadius: m.from === "avatar" ? "20px 20px 20px 6px" : "20px 20px 6px 20px", padding: "14px 18px", fontSize: 16, lineHeight: 1.55, boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>{m.text}</div>
          </div>
        ))}
        {typing && (
          <div style={{ display: "flex", gap: 6, padding: "12px 16px" }}>
            {[0, 0.2, 0.4].map((d, i) => <div key={i} className="typing-dot" style={{ animationDelay: `${d}s` }} />)}
          </div>
        )}
        {memorySuggestions.length > 0 && (
          <div style={{ background: "#FFF3E8", borderRadius: 14, padding: "12px 14px", color: theme.warm, fontSize: 13, lineHeight: 1.4 }}>
            Memory suggestion: {memorySuggestions[0].content}
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px 28px", background: theme.white + "EE", backdropFilter: "blur(12px)", borderTop: `1px solid ${theme.blush}44` }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={() => setListening(l => !l)} className={`mic-btn${listening ? " mic-btn-active" : ""}`}>{listening ? "🔴" : "🎤"}</button>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)} placeholder="Type your response..." className="chat-input" />
          <button onClick={() => sendMessage(input)} className="send-btn">➤</button>
        </div>
      </div>
    </div>
  );
}

function EndScreen({ onHome }) {
  const stats = [
    { label: "Duration", value: "18 mins", icon: "⏱️" },
    { label: "Topics Covered", value: "4", icon: "💬" },
    { label: "Engagement", value: "High", icon: "⭐" },
    { label: "Mood", value: "Happy", icon: "😊" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${theme.cream}, ${theme.sand})`, padding: "48px 28px 40px", maxWidth: 480, margin: "0 auto" }}>
      <div className="fade-up" style={{ textAlign: "center", marginBottom: 36 }}>
        <div className="avatar-float" style={{ fontSize: 64, marginBottom: 16 }}>🌟</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 600, color: theme.text }}>Great session, Margaret!</div>
        <div style={{ fontSize: 16, color: theme.textLight, marginTop: 8, lineHeight: 1.6 }}>You did wonderfully today.<br />Keep up the wonderful work!</div>
      </div>

      <div className="fade-up delay-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 28 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: theme.white, borderRadius: 18, padding: "20px 16px", textAlign: "center", boxShadow: "0 4px 20px rgba(139,107,90,0.08)" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{s.value}</div>
            <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="fade-up delay-2" style={{ background: theme.white, borderRadius: 20, padding: "20px 22px", marginBottom: 28 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.textLight, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Session Highlights</div>
        {["Discussed childhood memories from the garden 🌼", "Completed 3 word association rounds", "Shared a favourite song from the 1960s 🎵"].map((h, i, arr) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < arr.length - 1 ? 12 : 0, fontSize: 15, color: theme.text, lineHeight: 1.5 }}>
            <span style={{ color: theme.sageDark, fontWeight: 700, marginTop: 1 }}>✓</span>{h}
          </div>
        ))}
      </div>

      <div className="fade-up delay-3" style={{ background: `linear-gradient(135deg, ${theme.blush}44, ${theme.rose}22)`, borderRadius: 20, padding: "20px 22px", marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14 }}>How did today's session feel?</div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          {["😞", "😐", "🙂", "😊", "😄"].map((e, i) => <EmojiButton key={i} emoji={e} />)}
        </div>
      </div>

      <div className="fade-up delay-4" style={{ display: "flex", gap: 12 }}>
        <button onClick={onHome} className="btn-outline" style={{ flex: 1, padding: "16px", fontSize: 16 }}>← Home</button>
        <button onClick={onHome} className="btn-primary" style={{ flex: 2 }}>Book Next Session ▸</button>
      </div>
    </div>
  );
}

function EmojiButton({ emoji }) {
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => setActive(!active)} style={{
      width: 48, height: 48, borderRadius: 14,
      background: active ? theme.white : "transparent",
      border: `2px solid ${active ? "#E8A090" : "transparent"}`,
      fontSize: 26, cursor: "pointer", transition: "all 0.15s",
      boxShadow: active ? "0 4px 16px #E8A09044" : "none",
    }}>{emoji}</button>
  );
}

function CaregiverScreen({ onBack }) {
  const [tab, setTab] = useState("summary");

  const tabs = [{ id: "summary", label: "Summary" }, { id: "memory", label: "Memory Bank" }, { id: "history", label: "History" }];

  const memories = [
    { tag: "Family", text: "Has a daughter named Sarah who lives in Wellington" },
    { tag: "Hobbies", text: "Loves gardening and growing roses" },
    { tag: "Music", text: "Favourite era: 1960s; likes The Beatles" },
    { tag: "Food", text: "Enjoys a cup of Earl Grey in the morning" },
    { tag: "Places", text: "Grew up in Christchurch, moved to Auckland in 1978" },
  ];

  const sessions = [
    { date: "Today", duration: "18 min", mood: "😊", topics: "Reminiscence, Word Games" },
    { date: "Yesterday", duration: "22 min", mood: "🙂", topics: "Music & Arts, Current Events" },
    { date: "Mon 28 Apr", duration: "15 min", mood: "😊", topics: "Word Games" },
    { date: "Sun 27 Apr", duration: "20 min", mood: "😐", topics: "Reminiscence" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, #E8EDF5 0%, #FDF6EE 50%)`, maxWidth: 480, margin: "0 auto" }}>
      <div style={{ padding: "24px 24px 0", background: "linear-gradient(135deg, #B8CDD866, #7A9DAD33)", borderBottom: "1px solid #B8CDD888" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>←</button>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 600, color: theme.text }}>Caregiver View</div>
            <div style={{ fontSize: 13, color: theme.textLight }}>Margaret's profile</div>
          </div>
        </div>
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
      </div>

      <div style={{ padding: "24px" }}>
        {tab === "summary" && (
          <div className="fade-up">
            <div style={{ background: theme.white, borderRadius: 20, padding: "20px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Latest Session</div>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {[{ label: "Emotional State", value: "Positive 😊", color: "#A8C5A0" }, { label: "Engagement", value: "High ⭐", color: "#F4C8B0" }, { label: "Cognitive Score", value: "78 / 100", color: "#B8CDD8" }].map(s => (
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
              <div style={{ fontSize: 14, color: theme.textLight, lineHeight: 1.5 }}>Margaret appeared briefly sad when discussing her late husband. Consider checking in on her mood today.</div>
            </div>
          </div>
        )}

        {tab === "memory" && (
          <div className="fade-up">
            <div style={{ fontSize: 14, color: theme.textLight, marginBottom: 16, lineHeight: 1.6 }}>These are memories Aria uses to personalise sessions for Margaret. You can add or edit them below.</div>
            {memories.map((m, i) => (
              <div key={i} style={{ background: theme.white, borderRadius: 16, padding: "16px 18px", marginBottom: 10, display: "flex", alignItems: "flex-start", gap: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}>
                <span style={{ background: "#B8CDD855", borderRadius: 8, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: theme.mistDark, flexShrink: 0, marginTop: 2 }}>{m.tag}</span>
                <span style={{ fontSize: 15, color: theme.text, flex: 1, lineHeight: 1.5 }}>{m.text}</span>
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: theme.textLight }}>✏️</button>
              </div>
            ))}
            <button className="btn-mist" style={{ width: "100%", marginTop: 8 }}>+ Add Memory</button>
          </div>
        )}

        {tab === "history" && (
          <div className="fade-up">
            {sessions.map((s, i) => (
              <div key={i} style={{ background: theme.white, borderRadius: 18, padding: "18px", marginBottom: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{s.date}</div>
                  <div style={{ fontSize: 20 }}>{s.mood}</div>
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ fontSize: 13, color: theme.textLight }}>⏱ {s.duration}</div>
                  <div style={{ fontSize: 13, color: theme.textLight }}>🗣 {s.topics}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING);
  return (
    <>
      {screen === SCREENS.LANDING && <LandingScreen onStart={() => setScreen(SCREENS.SESSION)} onCaregiver={() => setScreen(SCREENS.CAREGIVER)} />}
      {screen === SCREENS.SESSION && <SessionScreen onEnd={() => setScreen(SCREENS.END)} />}
      {screen === SCREENS.END && <EndScreen onHome={() => setScreen(SCREENS.LANDING)} />}
      {screen === SCREENS.CAREGIVER && <CaregiverScreen onBack={() => setScreen(SCREENS.LANDING)} />}
    </>
  );
}

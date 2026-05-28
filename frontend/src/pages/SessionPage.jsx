import { useState, useEffect, useRef } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";

export default function SessionPage({ sessionId, onEnd, userName }) {
  const isDesktop = useIsDesktop();
  const [messages, setMessages] = useState([
    { from: "avatar", text: `Hello ${userName}! Lovely to see you today. How are you feeling this afternoon? 😊` },
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const scrollRef = useRef(null);
  const replyIndex = useRef(0);
  const startTime = useRef(Date.now());

  const avatarReplies = [
    "That's wonderful to hear! Let's start with a little word game. I'll say a word, and you tell me the first thing that comes to mind. Ready? 🌈 Rainbow!",
    "Lovely! Speaking of colours, do you have a favourite colour that reminds you of a special memory?",
    "How beautiful! You have such a vivid memory. Tell me more about that time — what was the weather like?",
    "That sounds absolutely lovely. Shall we try a music round next? 🎵",
  ];

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTime.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const formatElapsed = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const sendMessage = async (text) => {
    if (!text.trim()) return;
    setMessages(m => [...m, { from: "user", text }]);
    setInput("");
    if (sessionId) {
      api.post(`/sessions/${sessionId}/messages`, { role: "user", content: text }).catch(() => {});
    }
    setTyping(true);
    setTimeout(async () => {
      setTyping(false);
      const reply = avatarReplies[replyIndex.current++ % avatarReplies.length];
      setMessages(m => [...m, { from: "avatar", text: reply }]);
      if (sessionId) {
        api.post(`/sessions/${sessionId}/messages`, { role: "assistant", content: reply }).catch(() => {});
      }
    }, 1800);
  };

  const avatarPanel = (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: isDesktop ? "48px 32px" : "28px 24px 12px",
      width: isDesktop ? 280 : "100%",
      flexShrink: 0,
      borderRight: isDesktop ? `1px solid ${theme.blush}44` : "none",
      justifyContent: isDesktop ? "center" : undefined,
    }}>
      <div style={{ position: "relative", width: 130, height: 130 }}>
        {listening && [0, 0.4, 0.8].map((d, i) => (
          <div key={i} className="ripple-ring" style={{ animationDelay: `${d}s` }} />
        ))}
        <div className="avatar-float" style={{ width: 130, height: 130, borderRadius: "50%", background: `linear-gradient(145deg, ${theme.blush}, #D4A882)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, boxShadow: `0 8px 40px ${theme.blush}88`, position: "relative", zIndex: 1 }}>🧓</div>
      </div>
      <div style={{ marginTop: 12, fontSize: 16, fontWeight: 700, color: theme.text, fontFamily: "'Playfair Display', serif" }}>Aria</div>
      <div style={{ fontSize: 12, color: theme.textLight }}>Your therapy companion</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(180deg, #E8D5C4 0%, ${theme.cream} 40%)`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${theme.blush}55`, background: theme.white + "CC", backdropFilter: "blur(12px)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="pulse-dot" />
          <span style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>Session in progress</span>
        </div>
        <div style={{ fontSize: 13, color: theme.textLight }}>Reminiscence · {formatElapsed(elapsed)}</div>
        <button onClick={onEnd} style={{ background: "#FDE8E8", border: "none", borderRadius: 12, padding: "8px 14px", fontSize: 13, color: "#C0504D", cursor: "pointer", fontWeight: 600, fontFamily: "'Nunito', sans-serif" }}>End</button>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: isDesktop ? "row" : "column", minHeight: 0 }}>
        {avatarPanel}

        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
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
          </div>

          <div style={{ padding: "16px 20px 28px", background: theme.white + "EE", backdropFilter: "blur(12px)", borderTop: `1px solid ${theme.blush}44`, flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => setListening(l => !l)} className={`mic-btn${listening ? " mic-btn-active" : ""}`}>{listening ? "🔴" : "🎤"}</button>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && sendMessage(input)} placeholder="Type your response..." className="chat-input" />
              <button onClick={() => sendMessage(input)} className="send-btn">➤</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

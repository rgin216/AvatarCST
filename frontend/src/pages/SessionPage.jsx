import { useEffect, useRef, useState } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";

const defaultSlide = {
  index: 0,
  total: 6,
  title: "Welcome Back",
  subtitle: "A gentle start",
  prompt: "How are you feeling right now?",
  bullets: ["Take your time", "Notice your body", "Share one feeling"],
  visualHint: "Warm sitting room with soft daylight and a cup of tea",
  accent: theme.blush,
};

const defaultAvatar = {
  audio: {
    status: "pending_generation",
    model: "gpt-realtime-mini",
    voice: "marin",
  },
  lipsync: {
    status: "waiting_for_audio",
    visemes: [],
  },
};

export default function SessionPage({ sessionId, onEnd, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slide, setSlide] = useState(defaultSlide);
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [visemeTick, setVisemeTick] = useState(0);
  const [connectionLabel, setConnectionLabel] = useState("Preparing session");
  const booted = useRef(false);
  const scrollRef = useRef(null);
  const startTime = useRef(null);

  useEffect(() => {
    startTime.current = Date.now();
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  const applyTurn = (turn) => {
    setSlide(turn.slide || defaultSlide);
    setAvatar(turn.avatar || defaultAvatar);
    if (turn.assistantText) {
      setMessages((items) => [...items, { from: "avatar", text: turn.assistantText }]);
    }
  };

  useEffect(() => {
    if (!sessionId || booted.current) return;
    booted.current = true;

    const startTurn = async () => {
      setTyping(true);
      try {
        const { data } = await api.post(`/sessions/${sessionId}/respond`, { content: "" });
        applyTurn(data);
        setConnectionLabel("Realtime-ready turn contract");
      } catch (err) {
        console.error("Failed to start orchestrated session", err);
        const fallback = `Hello ${userName}. It is lovely to see you today. How are you feeling right now?`;
        setMessages([{ from: "avatar", text: fallback }]);
        setConnectionLabel("Local fallback");
      } finally {
        setTyping(false);
      }
    };

    startTurn();
  }, [sessionId, userName]);

  useEffect(() => {
    const timer = setInterval(() => {
      setVisemeTick((value) => value + 1);
    }, 180);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const sendMessage = async (text) => {
    const content = text.trim();
    if (!content || typing) return;

    setMessages((items) => [...items, { from: "user", text: content }]);
    setInput("");
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, { content });
      applyTurn(data);
      setConnectionLabel("Realtime-ready turn contract");
    } catch (err) {
      console.error("Failed to get assistant response", err);
      setMessages((items) => [
        ...items,
        {
          from: "avatar",
          text: "I am having trouble connecting right now. Let us take a breath and try again in a moment.",
        },
      ]);
      setConnectionLabel("Connection issue");
    } finally {
      setTyping(false);
    }
  };

  const visemes = avatar?.lipsync?.visemes || [];
  const mouth = visemes.length > 0 ? visemes[visemeTick % visemes.length].mouth : "rest";
  const mouthShape = {
    rest: "18px 7px 18px 7px",
    AI: "18px 18px 14px 14px",
    E: "24px 8px 24px 8px",
    O: "16px 22px 16px 22px",
  }[mouth] || "18px 7px 18px 7px";

  return (
    <div className="session-stage">
      <header className="session-topbar">
        <div className="session-status">
          <span className="pulse-dot" />
          <span>Session in progress</span>
        </div>
        <div className="session-meta">Reminiscence / {formatElapsed(elapsed)}</div>
        <button onClick={onEnd} className="session-end-button">End</button>
      </header>

      <main className="session-slide-shell">
        <section className="ppt-slide" style={{ "--slide-accent": slide.accent || theme.blush }}>
          <div className="ppt-slide-progress">
            Slide {slide.index + 1} / {slide.total}
          </div>
          <div className="ppt-slide-content">
            <p className="ppt-slide-kicker">{slide.subtitle}</p>
            <h1>{slide.title}</h1>
            <p className="ppt-slide-prompt">{slide.prompt}</p>
            <div className="ppt-slide-bullets">
              {(slide.bullets || []).map((bullet) => (
                <span key={bullet}>{bullet}</span>
              ))}
            </div>
          </div>
          <div className="ppt-slide-visual">
            <div className="ppt-slide-window" />
            <p>{slide.visualHint}</p>
          </div>
        </section>

        <aside className="session-transcript" ref={scrollRef}>
          {messages.map((message, index) => (
            <div key={`${message.from}-${index}`} className={`session-bubble ${message.from}`}>
              {message.text}
            </div>
          ))}
          {typing && (
            <div className="session-bubble avatar">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </div>
          )}
        </aside>

        <section className="avatar-dock" aria-label="Aria avatar">
          <div className="avatar-status">
            <span>{connectionLabel}</span>
            <strong>{avatar.audio?.model || "gpt-realtime-mini"}</strong>
          </div>
          <div className={`avatar-figure${listening || typing ? " active" : ""}`}>
            <div className="avatar-head">
              <div className="avatar-eye left" />
              <div className="avatar-eye right" />
              <div className="avatar-mouth" style={{ borderRadius: mouthShape }} />
            </div>
            <div className="avatar-torso" />
          </div>
          <div className="avatar-readiness">
            <span>Audio: {avatar.audio?.status || "pending"}</span>
            <span>Lipsync: {avatar.lipsync?.status || "waiting"}</span>
          </div>
        </section>
      </main>

      <footer className="session-input-bar">
        <button
          type="button"
          onClick={() => setListening((value) => !value)}
          className={`mic-btn${listening ? " mic-btn-active" : ""}`}
          aria-label={listening ? "Stop microphone" : "Start microphone"}
        >
          {listening ? "Rec" : "Mic"}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && sendMessage(input)}
          placeholder="Type your response..."
          className="chat-input"
        />
        <button type="button" onClick={() => sendMessage(input)} className="send-btn" aria-label="Send">
          Send
        </button>
      </footer>
    </div>
  );
}

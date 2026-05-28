import { useEffect, useRef, useState } from "react";
import AvatarViewer from "../components/avatar/AvatarViewer";
import api from "../services/api.js";
import {
  createEmptyLipSyncFrame,
  getRhubarbMorphStateAtTime,
  rhubarbJsonToTimeline,
} from "../utils/lipSync.js";
import theme from "../utils/theme";

const defaultSlide = {
  index: 0,
  total: 14,
  deckSlide: 1,
  title: "Virtual Cognitive Stimulation Therapy",
  subtitle: "Session 1: Introduction & Welcome",
  prompt: "How are you feeling right now?",
  bullets: ["Welcome", "No preparation needed", "Nothing you can get wrong"],
  visualHint: "Source deck: NZ01. Welcome.pptx, slide 1",
  accent: "#00AEEF",
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

const audioFixtures = [
  {
    id: "1980s-singers",
    label: "1980s singers",
    audioUrl: "/audio/placeholder-1980s-singers.wav",
    lipsyncUrl: "/lipsync/placeholder-1980s-singers.json",
  },
  {
    id: "great-wall",
    label: "Great Wall",
    audioUrl: "/audio/placeholder-great-wall.wav",
    lipsyncUrl: "/lipsync/placeholder-great-wall.json",
  },
];

export default function SessionPage({ sessionId, onEnd, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slide, setSlide] = useState(defaultSlide);
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [connectionLabel, setConnectionLabel] = useState("Preparing session");
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [timeline, setTimeline] = useState(null);
  const [lipSyncStatus, setLipSyncStatus] = useState("Loading Rhubarb fixture");
  const booted = useRef(false);
  const scrollRef = useRef(null);
  const startTime = useRef(null);
  const audioRef = useRef(null);
  const animationRef = useRef(null);
  const lipSyncFrameRef = useRef(createEmptyLipSyncFrame());
  const activeFixture = audioFixtures[fixtureIndex];

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

  useEffect(() => {
    let cancelled = false;

    async function loadLipSyncFixture() {
      setLipSyncStatus("Loading Rhubarb fixture");
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      try {
        const response = await fetch(activeFixture.lipsyncUrl);
        if (!response.ok) throw new Error("Could not load lipsync JSON");
        const rhubarbJson = await response.json();
        const nextTimeline = rhubarbJsonToTimeline(rhubarbJson, { minCueSeconds: 0.04 });
        if (cancelled) return;
        setTimeline(nextTimeline);
        setLipSyncStatus(`Rhubarb fixture ready (${nextTimeline.rawCueCount} cues)`);
      } catch (err) {
        console.error("Failed to load Rhubarb fixture", err);
        if (!cancelled) {
          setTimeline(null);
          setLipSyncStatus("Rhubarb fixture unavailable");
        }
      }
    }

    loadLipSyncFixture();
    return () => {
      cancelled = true;
    };
  }, [activeFixture.lipsyncUrl]);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  function applyTurn(turn) {
    setSlide(turn.slide || defaultSlide);
    setAvatar(turn.avatar || defaultAvatar);
    if (turn.assistantText) {
      setMessages((items) => [...items, { from: "avatar", text: turn.assistantText }]);
    }
  }

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

  const formatElapsed = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  function publishLipSyncFrame(isPlaying) {
    const audio = audioRef.current;

    if (!audio || !timeline || !isPlaying) {
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      return;
    }

    lipSyncFrameRef.current = getRhubarbMorphStateAtTime(timeline, audio.currentTime, {
      intensity: 1.5,
      blendWindow: 0.03,
    });
  }

  function tickLipSync() {
    const audio = audioRef.current;
    const isPlaying = Boolean(audio && !audio.paused && !audio.ended);
    publishLipSyncFrame(isPlaying);

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(tickLipSync);
    }
  }

  async function playPlaceholderAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    try {
      await audio.play();
      tickLipSync();
      setLipSyncStatus(`Playing ${activeFixture.label}`);
    } catch (err) {
      console.error("Could not play placeholder audio", err);
      setLipSyncStatus("Press the audio controls to play");
    }
  }

  function handleAudioPause() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    publishLipSyncFrame(false);
    setLipSyncStatus(timeline ? `Rhubarb fixture ready (${timeline.rawCueCount} cues)` : "Paused");
  }

  async function sendMessage(text) {
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
  }

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
        <section
          className="ppt-slide"
          style={{
            "--slide-accent": slide.accent || theme.blush,
            backgroundImage: slide.imageUrl ? `url(${slide.imageUrl})` : undefined,
          }}
        >
          <div className="ppt-slide-progress">
            Session step {slide.index + 1} / {slide.total}
            {slide.deckSlide ? ` / Deck slide ${slide.deckSlide}` : ""}
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
          <div className="avatar-figure real-avatar">
            <AvatarViewer lipSyncFrameRef={lipSyncFrameRef} />
          </div>
          <div className="avatar-readiness">
            <span>Audio: placeholder WAV</span>
            <span>Lipsync: {lipSyncStatus}</span>
          </div>
          <div className="avatar-audio-controls">
            <select
              value={fixtureIndex}
              onChange={(event) => setFixtureIndex(Number(event.target.value))}
              aria-label="Placeholder audio"
            >
              {audioFixtures.map((fixture, index) => (
                <option key={fixture.id} value={index}>
                  {fixture.label}
                </option>
              ))}
            </select>
            <button type="button" onClick={playPlaceholderAudio}>
              Play test audio
            </button>
          </div>
          <audio
            ref={audioRef}
            src={activeFixture.audioUrl}
            onPlay={tickLipSync}
            onPause={handleAudioPause}
            onEnded={handleAudioPause}
            onSeeked={() => publishLipSyncFrame(Boolean(audioRef.current && !audioRef.current.paused))}
            controls
          />
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

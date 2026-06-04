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
  imageUrl: "/slides/session1/slide-01.jpg",
  title: "Virtual Cognitive Stimulation Therapy",
  subtitle: "Session 1: Introduction & Welcome",
  prompt: "How are you feeling right now?",
  bullets: ["Welcome", "No preparation needed", "Nothing you can get wrong"],
  visualHint: "Source deck: NZ01. Welcome.pptx, slide 1",
  accent: "#00AEEF",
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

const avatarModes = [
  { id: "male", label: "Male" },
  { id: "female", label: "Alt avatar" },
  { id: "visualizer", label: "Audio visual" },
];
const avatarModeIds = new Set(avatarModes.map((mode) => mode.id));

function getInitialAvatarMode() {
  if (!import.meta.env.DEV) return "male";
  const requestedMode = new URLSearchParams(window.location.search).get("avatar");
  return avatarModeIds.has(requestedMode) ? requestedMode : "male";
}

const LIP_SYNC_SETTINGS = {
  intensity: 1.5,
  minCueSeconds: 0.025,
  blendWindow: 0.04,
  leadSeconds: 0.055,
};

export default function SessionPage({ sessionId, onEnd, userName }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slide, setSlide] = useState(defaultSlide);
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [avatarMode, setAvatarMode] = useState(getInitialAvatarMode);
  const [timeline, setTimeline] = useState(null);
  const booted = useRef(false);
  const scrollRef = useRef(null);
  const startTime = useRef(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioMeterRef = useRef(null);
  const audioSamplesRef = useRef(null);
  const mediaSourceRef = useRef(null);
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
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      try {
        const response = await fetch(activeFixture.lipsyncUrl);
        if (!response.ok) throw new Error("Could not load lipsync JSON");
        const rhubarbJson = await response.json();
        const nextTimeline = rhubarbJsonToTimeline(rhubarbJson, {
          minCueSeconds: LIP_SYNC_SETTINGS.minCueSeconds,
        });
        if (cancelled) return;
        setTimeline(nextTimeline);
      } catch (err) {
        console.error("Failed to load Rhubarb fixture", err);
        if (!cancelled) {
          setTimeline(null);
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

  useEffect(() => {
    return () => {
      audioContextRef.current?.close();
    };
  }, []);

  function applyTurn(turn) {
    setSlide(turn.slide || defaultSlide);
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
      } catch (err) {
        console.error("Failed to start orchestrated session", err);
        const fallback = `Hello ${userName}. It is lovely to see you today. How are you feeling right now?`;
        setMessages([{ from: "avatar", text: fallback }]);
      } finally {
        setTyping(false);
      }
    };

    startTurn();
  }, [sessionId, userName]);

  const formatElapsed = (seconds) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  async function ensureAudioMeter() {
    const audio = audioRef.current;
    if (!audio) return;

    if (audioMeterRef.current) {
      await audioContextRef.current?.resume();
      return;
    }

    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    mediaSourceRef.current = audioContext.createMediaElementSource(audio);
    mediaSourceRef.current.connect(analyser);
    analyser.connect(audioContext.destination);
    audioContextRef.current = audioContext;
    audioMeterRef.current = analyser;
    audioSamplesRef.current = new Float32Array(analyser.fftSize);

    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }
  }

  function getSpeechEnergy() {
    const analyser = audioMeterRef.current;
    const samples = audioSamplesRef.current;

    if (!analyser || !samples) return 0;

    analyser.getFloatTimeDomainData(samples);

    let sum = 0;
    for (let i = 0; i < samples.length; i += 1) {
      sum += samples[i] * samples[i];
    }

    const rms = Math.sqrt(sum / samples.length);
    return Math.min(1, Math.max(0, (rms - 0.015) * 4.8));
  }

  function publishLipSyncFrame(isPlaying) {
    const audio = audioRef.current;

    if (!audio || !timeline || !isPlaying) {
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      return;
    }

    const frame = getRhubarbMorphStateAtTime(
      timeline,
      audio.currentTime + LIP_SYNC_SETTINGS.leadSeconds,
      {
        intensity: LIP_SYNC_SETTINGS.intensity,
        blendWindow: LIP_SYNC_SETTINGS.blendWindow,
      },
    );

    lipSyncFrameRef.current = {
      ...frame,
      speechEnergy: getSpeechEnergy(),
    };
  }

  function tickLipSync() {
    const audio = audioRef.current;
    const isPlaying = Boolean(audio && !audio.paused && !audio.ended);
    publishLipSyncFrame(isPlaying);

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(tickLipSync);
    }
  }

  function startLipSyncPlayback() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    tickLipSync();
  }

  async function playPlaceholderAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);

    try {
      await ensureAudioMeter();
      await audio.play();
      startLipSyncPlayback();
    } catch (err) {
      console.error("Could not play placeholder audio", err);
    }
  }

  async function handleAudioPlay() {
    await ensureAudioMeter();
    startLipSyncPlayback();
  }

  function handleAudioPause() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    publishLipSyncFrame(false);
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
    } catch (err) {
      console.error("Failed to get assistant response", err);
      setMessages((items) => [
        ...items,
        {
          from: "avatar",
          text: "I am having trouble connecting right now. Let us take a breath and try again in a moment.",
        },
      ]);
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
          className={`ppt-slide${slide.imageUrl ? " has-slide-image" : ""}`}
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
          <div className="avatar-figure real-avatar">
            <AvatarViewer avatarMode={avatarMode} lipSyncFrameRef={lipSyncFrameRef} />
          </div>
          <div className="avatar-audio-controls">
            <select
              value={avatarMode}
              onChange={(event) => setAvatarMode(event.target.value)}
              aria-label="Avatar mode"
            >
              {avatarModes.map((mode) => (
                <option key={mode.id} value={mode.id}>
                  {mode.label}
                </option>
              ))}
            </select>
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
            onPlay={handleAudioPlay}
            onPause={handleAudioPause}
            onEnded={handleAudioPause}
            onSeeked={() => publishLipSyncFrame(Boolean(audioRef.current && !audioRef.current.paused))}
            preload="metadata"
            hidden
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

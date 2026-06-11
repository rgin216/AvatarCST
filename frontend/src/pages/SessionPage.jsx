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
  { id: "female", label: "Female" },
  { id: "visualizer", label: "Audio visual" },
];
const avatarModeIds = new Set(avatarModes.map((mode) => mode.id));

function getInitialAvatarMode() {
  if (!import.meta.env.DEV) return "male";
  const requestedMode = new URLSearchParams(window.location.search).get("avatar");
  return avatarModeIds.has(requestedMode) ? requestedMode : "male";
}

// Strips '/api' suffix so the frontend can build full backend URLs for audio files.
function getBackendBase() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/api$/, "");
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
  const [isRecording, setIsRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slide, setSlide] = useState(defaultSlide);
  const [fixtureIndex, setFixtureIndex] = useState(0);
  const [avatarMode, setAvatarMode] = useState(getInitialAvatarMode);
  const timelineRef = useRef(null);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [pipelineMode, setPipelineMode] = useState("free");

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
  const mediaRecorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const voicePlaceholderIdRef = useRef(null);

  const activeFixture = audioFixtures[fixtureIndex];

  // Fetch pipeline mode from backend on mount
  useEffect(() => {
    api.get("/sessions/pipeline").then(({ data }) => {
      if (data?.mode) setPipelineMode(data.mode);
    }).catch(() => {});
  }, []);

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

  // Load fixture lipsync JSON only when no live audio is pending
  useEffect(() => {
    let cancelled = false;

    async function loadFixture() {
      timelineRef.current = null;
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      try {
        const response = await fetch(activeFixture.lipsyncUrl);
        if (!response.ok) throw new Error("Could not load lipsync JSON");
        const rhubarbJson = await response.json();
        const nextTimeline = rhubarbJsonToTimeline(rhubarbJson, {
          minCueSeconds: LIP_SYNC_SETTINGS.minCueSeconds,
        });
        if (!cancelled) timelineRef.current = nextTimeline;
      } catch (err) {
        console.error("Failed to load Rhubarb fixture", err);
      }
    }

    loadFixture();
    return () => {
      cancelled = true;
      timelineRef.current = null;
    };
  }, [activeFixture.lipsyncUrl]);

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  useEffect(() => () => {
    audioContextRef.current?.close();
  }, []);

  function applyTurn(turn) {
    const slideData = turn.slide || defaultSlide;
    setSlide(slideData);

    if (turn.assistantText) {
      const debugSuffix = import.meta.env.DEV
        ? ` [Step ${slideData.index + 1}/${slideData.total}: ${slideData.title}]`
        : "";
      setMessages((items) => [...items, { from: "avatar", text: turn.assistantText + debugSuffix }]);
    }

    // Update voice placeholder message with the real transcript
    if (turn.transcript && voicePlaceholderIdRef.current != null) {
      const placeholderId = voicePlaceholderIdRef.current;
      voicePlaceholderIdRef.current = null;
      setMessages((items) =>
        items.map((msg) =>
          msg._id === placeholderId ? { ...msg, text: turn.transcript } : msg
        )
      );
    }

    // Real audio from free pipeline — load and auto-play
    if (turn.avatar?.audio?.url) {
      const audioUrl = getBackendBase() + turn.avatar.audio.url;
      playLiveAudio(audioUrl, turn.avatar?.lipsync?.rhubarbJson ?? null);
    }
  }

  async function playLiveAudio(audioUrl, rhubarbJson) {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.src = audioUrl;
    audio.load();

    // Update ref synchronously so the animation loop reads it on the very first frame
    timelineRef.current = rhubarbJson
      ? rhubarbJsonToTimeline(rhubarbJson, { minCueSeconds: LIP_SYNC_SETTINGS.minCueSeconds })
      : null;

    try {
      await ensureAudioMeter();
      await audio.play();
      startLipSyncPlayback();
      setPendingPlay(false);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        // Autoplay blocked — show manual play button
        setPendingPlay(true);
      } else if (err.name !== "AbortError") {
        console.warn("Audio play error:", err.message);
      }
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
    for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
    const rms = Math.sqrt(sum / samples.length);
    return Math.min(1, Math.max(0, (rms - 0.015) * 4.8));
  }

  function publishLipSyncFrame(isPlaying) {
    const audio = audioRef.current;
    const currentTimeline = timelineRef.current;
    if (!audio || !currentTimeline || !isPlaying) {
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      return;
    }
    const frame = getRhubarbMorphStateAtTime(
      currentTimeline,
      audio.currentTime + LIP_SYNC_SETTINGS.leadSeconds,
      { intensity: LIP_SYNC_SETTINGS.intensity, blendWindow: LIP_SYNC_SETTINGS.blendWindow },
    );
    lipSyncFrameRef.current = { ...frame, speechEnergy: getSpeechEnergy() };
  }

  function tickLipSync() {
    const audio = audioRef.current;
    const isPlaying = Boolean(audio && !audio.paused && !audio.ended);
    publishLipSyncFrame(isPlaying);
    if (isPlaying) animationRef.current = requestAnimationFrame(tickLipSync);
  }

  function startLipSyncPlayback() {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    tickLipSync();
  }

  async function playPlaceholderAudio() {
    const audio = audioRef.current;
    if (!audio) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    // Reset to fixture audio if we were playing live audio
    if (audio.src !== activeFixture.audioUrl) {
      audio.src = activeFixture.audioUrl;
      audio.load();
    }
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

  // --- Mic recording (free pipeline) ---

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      recordingChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordingChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        await sendAudioToBackend(blob);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function sendAudioToBackend(blob) {
    if (typing) return;

    // Add a placeholder that will be replaced with the real transcript on response
    const placeholderId = Date.now();
    voicePlaceholderIdRef.current = placeholderId;
    setMessages((items) => [...items, { from: "user", text: "...", _id: placeholderId }]);
    setTyping(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const { data } = await api.post(`/sessions/${sessionId}/respond-audio`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      applyTurn(data);
    } catch (err) {
      console.error("Failed to send audio:", err);
      setMessages((items) => [
        ...items,
        { from: "avatar", text: "I could not hear that clearly. Please try again or type your response." },
      ]);
    } finally {
      setTyping(false);
    }
  }

  function handleMicClick() {
    if (pipelineMode === "realtime") {
      // Realtime pipeline will be wired up here — uses OpenAI Realtime mini via WebRTC
      console.info("Realtime pipeline not yet configured. Set PIPELINE_MODE=free to use voice input.");
      return;
    }
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // --- Text input ---

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
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>
            <select
              value={fixtureIndex}
              onChange={(event) => setFixtureIndex(Number(event.target.value))}
              aria-label="Placeholder audio"
            >
              {audioFixtures.map((fixture, index) => (
                <option key={fixture.id} value={index}>{fixture.label}</option>
              ))}
            </select>
            <button type="button" onClick={playPlaceholderAudio}>
              Play test audio
            </button>
            {pendingPlay && (
              <button
                type="button"
                onClick={() => {
                  audioRef.current?.play().then(() => {
                    setPendingPlay(false);
                    startLipSyncPlayback();
                  });
                }}
              >
                ▶ Play response
              </button>
            )}
          </div>
          <audio
            ref={audioRef}
            src={activeFixture.audioUrl}
            crossOrigin="anonymous"
            onPlay={handleAudioPlay}
            onPause={handleAudioPause}
            onEnded={() => { handleAudioPause(); setPendingPlay(false); }}
            onSeeked={() => publishLipSyncFrame(Boolean(audioRef.current && !audioRef.current.paused))}
            preload="metadata"
            hidden
          />
        </section>
      </main>

      <footer className="session-input-bar">
        <button
          type="button"
          onClick={handleMicClick}
          className={`mic-btn${isRecording ? " mic-btn-active" : ""}`}
          aria-label={isRecording ? "Stop recording" : "Start microphone"}
          disabled={typing && !isRecording}
          title={pipelineMode === "realtime" ? "Realtime mode — set PIPELINE_MODE=free to use mic" : undefined}
        >
          {isRecording ? "Stop" : "Mic"}
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

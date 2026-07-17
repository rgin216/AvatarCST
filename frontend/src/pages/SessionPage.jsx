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
  total: 8,
  deckSlide: 1,
  imageUrl: "/slides/session1/slide-01.jpg",
  title: "AI-supported Individual Cognitive Stimulation Therapy",
  subtitle: "Session 1: Introduction & Welcome",
  prompt: "How are you feeling right now?",
  bullets: ["Introduction & Welcome", "AI-supported CST", "University of Auckland"],
  visualHint: "Source deck: NZ01. Welcome, slide 1",
  accent: "#00AEEF",
};

const avatarModes = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "visualizer", label: "Audio visual" },
];
const avatarModeIds = new Set(avatarModes.map((mode) => mode.id));
const wheelColors = ["#7A9DAD", "#F47C20", "#A8C5A0", "#4472C4", "#F4C8B0"];

function getInitialAvatarMode() {
  if (!import.meta.env.DEV) return "male";
  const requestedMode = new URLSearchParams(window.location.search).get("avatar");
  return avatarModeIds.has(requestedMode) ? requestedMode : "male";
}

// Strips '/api' suffix so the frontend can build full backend URLs for audio files.
function getBackendBase() {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
  return apiUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

const LIP_SYNC_SETTINGS = {
  intensity: 1.5,
  minCueSeconds: 0.025,
  blendWindow: 0.04,
  leadSeconds: 0.055,
};

export default function SessionPage({ sessionId, onEnd, userName, pipelineMode: initialPipelineMode = "free" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [slide, setSlide] = useState(defaultSlide);
  const [avatarMode, setAvatarMode] = useState(getInitialAvatarMode);
  const [pendingPlay, setPendingPlay] = useState(false);
  const [questionWheel, setQuestionWheel] = useState(null);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelResultPending, setWheelResultPending] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [skipSlideInput, setSkipSlideInput] = useState("");
  const pipelineMode = initialPipelineMode || "free";
  const showDevSkip = import.meta.env.DEV;
  const timelineRef = useRef(null);
  const avatarModeRef = useRef(avatarMode);

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
  const mediaStreamRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const voicePlaceholderIdRef = useRef(null);
  const wheelTimeoutRef = useRef(null);
  const wheelResultPendingRef = useRef(false);
  const slideIdRef = useRef(defaultSlide.id);
  const wheelOptions = slide.interaction?.type === "questionWheel" ? slide.interaction.options || [] : [];
  const hasWheelInteraction = wheelOptions.length > 0;
  const exerciseVideo = slide.interaction?.type === "youtubeShort" ? slide.interaction : null;
  const hasSlideInteraction = hasWheelInteraction || Boolean(exerciseVideo);
  const landedWheelResult = questionWheel?.status === "landed" ? questionWheel : null;
  const sessionInputDisabled = typing || wheelResultPending;
  const wheelSliceDegrees = wheelOptions.length ? 360 / wheelOptions.length : 0;
  const wheelGradient = wheelOptions.length
    ? wheelOptions
        .map((_, index) => {
          const start = (index / wheelOptions.length) * 360;
          const end = ((index + 1) / wheelOptions.length) * 360;
          return `${wheelColors[index % wheelColors.length]} ${start}deg ${end}deg`;
        })
        .join(", ")
    : "";

  useEffect(() => {
    avatarModeRef.current = avatarMode;
    if (avatarMode === "visualizer") timelineRef.current = null;
  }, [avatarMode]);

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

  useEffect(() => () => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  useEffect(() => () => {
    if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
  }, []);

  useEffect(() => () => {
    audioContextRef.current?.close();
  }, []);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  function applyTurn(turn) {
    const slideData = turn.slide || defaultSlide;
    if (slideData.id !== slideIdRef.current) {
      slideIdRef.current = slideData.id;
      setWheelSpinning(false);
      wheelResultPendingRef.current = false;
      setWheelResultPending(false);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    }
    setSlide(slideData);
    setQuestionWheel(turn.questionWheel || null);

    if (turn.assistantText) {
      const debugSuffix = import.meta.env.DEV
        ? ` [Step ${slideData.index + 1}/${slideData.total}: ${slideData.title}]`
        : "";
      setMessages((items) => [...items, { from: "avatar", text: turn.assistantText + debugSuffix }]);
    }

    // Always resolve the voice placeholder — replace with transcript or remove if empty
    if (voicePlaceholderIdRef.current != null) {
      const placeholderId = voicePlaceholderIdRef.current;
      voicePlaceholderIdRef.current = null;
      setMessages((items) =>
        turn.transcript
          ? items.map((msg) => msg._id === placeholderId ? { ...msg, text: turn.transcript } : msg)
          : items.filter((msg) => msg._id !== placeholderId)
      );
    }

    // Real audio from free pipeline — load and auto-play
    if (turn.avatar?.audio?.url) {
      const audioUrl = getBackendBase() + turn.avatar.audio.url;
      const useRhubarb = avatarModeRef.current !== "visualizer";
      playLiveAudio(audioUrl, useRhubarb ? turn.avatar?.lipsync?.rhubarbJson : null);
    }
  }

  async function playLiveAudio(audioUrl, rhubarbJson = null) {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.crossOrigin = "anonymous";
    audio.src = audioUrl;
    audio.load();
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
        const { data } = await api.post(`/sessions/${sessionId}/respond`, {
          content: "",
          avatarMode: avatarModeRef.current,
        });
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
    if (!audio || !isPlaying) {
      lipSyncFrameRef.current = createEmptyLipSyncFrame();
      return;
    }

    if (currentTimeline) {
      const frame = getRhubarbMorphStateAtTime(
        currentTimeline,
        audio.currentTime + LIP_SYNC_SETTINGS.leadSeconds,
        { intensity: LIP_SYNC_SETTINGS.intensity, blendWindow: LIP_SYNC_SETTINGS.blendWindow },
      );
      lipSyncFrameRef.current = { ...frame, speechEnergy: getSpeechEnergy() };
      return;
    }

    const energy = getSpeechEnergy();
    lipSyncFrameRef.current = {
      visemes: {
        viseme_aa: energy * 0.28,
        mouthOpen: energy * 0.72,
      },
      jawOpen: energy * 0.45,
      speechEnergy: energy,
      active: energy > 0.015,
    };
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
    if (wheelResultPendingRef.current) return;

    try {
      setIsRecording(true);
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
        mediaStreamRef.current = null;
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        await sendAudioToBackend(blob);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      setIsRecording(true);
    } catch (err) {
      setIsRecording(false);
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
    if (typing || wheelResultPendingRef.current) return;

    // Add a placeholder that will be replaced with the real transcript on response
    const placeholderId = Date.now();
    voicePlaceholderIdRef.current = placeholderId;
    setMessages((items) => [...items, { from: "user", text: "Transcribing...", _id: placeholderId }]);
    setTyping(true);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("avatarMode", avatarModeRef.current);

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
    if (wheelResultPendingRef.current && !isRecording) return;

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }

  // --- Text input ---

  async function sendMessage(text) {
    const content = text.trim();
    if (!content || typing || wheelResultPendingRef.current) return;

    setMessages((items) => [...items, { from: "user", text: content }]);
    setInput("");
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content,
        avatarMode: avatarModeRef.current,
      });
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

  async function sendQuestionWheelResult(result) {
    if (!result || typing) return;

    setMessages((items) => [...items, { from: "user", text: `The wheel landed on ${result.label}.` }]);
    setTyping(true);

    try {
      const selection = result.id ? { optionId: result.id } : { label: result.label };
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: `[[question-wheel:${JSON.stringify(selection)}]]`,
        avatarMode: avatarModeRef.current,
      });
      applyTurn(data);
    } catch (err) {
      console.error("Failed to send wheel result", err);
      setMessages((items) => [
        ...items,
        {
          from: "avatar",
          text: "I could not spin the wheel just now. Please choose any question you like from the wheel.",
        },
      ]);
    } finally {
      setTyping(false);
      wheelResultPendingRef.current = false;
      setWheelResultPending(false);
    }
  }

  function handleWheelSpin() {
    if (
      typing ||
      isRecording ||
      wheelSpinning ||
      wheelResultPendingRef.current ||
      landedWheelResult ||
      wheelOptions.length === 0
    ) return;

    const selectedIndex = Math.floor(Math.random() * wheelOptions.length);
    const selected = wheelOptions[selectedIndex];
    const sliceDegrees = 360 / wheelOptions.length;
    const selectedCenterAngle = selectedIndex * sliceDegrees + sliceDegrees / 2;
    const rightPointerAngle = 90;

    wheelResultPendingRef.current = true;
    setWheelResultPending(true);
    setWheelSpinning(true);
    setWheelRotation((current) => {
      const currentNormalized = ((current % 360) + 360) % 360;
      const targetRotation = ((rightPointerAngle - selectedCenterAngle) % 360 + 360) % 360;
      const rotationDelta = (targetRotation - currentNormalized + 360) % 360;
      return current + 1080 + rotationDelta;
    });

    wheelTimeoutRef.current = setTimeout(() => {
      setWheelSpinning(false);
      sendQuestionWheelResult(selected);
    }, 1400);
  }

  async function handleSkipToSlide() {
    const requestedSlide = Number.parseInt(skipSlideInput, 10);
    const totalSlides = slide.total || 1;
    if (!sessionId || Number.isNaN(requestedSlide) || typing) return;

    const targetSlide = Math.min(Math.max(requestedSlide, 1), totalSlides);
    setTyping(true);

    try {
      await api.patch(`/sessions/${sessionId}`, {
        scriptStepIndex: targetSlide - 1,
        scriptStepTurnIndex: 0,
        scriptStepRetryCount: 0,
        interactionState: {},
      });
      setMessages((items) => [
        ...items,
        { from: "avatar", text: `Skipped to slide ${targetSlide} for testing.` },
      ]);
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: "",
        avatarMode: avatarModeRef.current,
      });
      applyTurn(data);
    } catch (err) {
      console.error("Failed to skip slide", err);
      setMessages((items) => [
        ...items,
        { from: "avatar", text: "I could not skip to that slide just now." },
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
        {showDevSkip && (
          <div className="session-skip-control" aria-label="Skip to slide for testing">
            <span>Skip</span>
            <input
              type="number"
              min="1"
              max={slide.total || 1}
              value={skipSlideInput}
              onChange={(event) => setSkipSlideInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && handleSkipToSlide()}
              placeholder="Slide"
              disabled={sessionInputDisabled}
            />
            <button type="button" onClick={handleSkipToSlide} disabled={sessionInputDisabled}>
              Go
            </button>
          </div>
        )}
        <button onClick={onEnd} className="session-end-button">End</button>
      </header>

      <main className="session-slide-shell">
        <section
          className={`ppt-slide${slide.imageUrl && !hasSlideInteraction ? " has-slide-image" : ""}${hasSlideInteraction ? " has-slide-interaction" : ""}${exerciseVideo ? " has-video-interaction" : ""}`}
          style={{
            "--slide-accent": slide.accent || theme.blush,
            backgroundImage: slide.imageUrl && !hasSlideInteraction ? `url(${slide.imageUrl})` : undefined,
          }}
        >
          <div className="ppt-slide-progress">
            Session step {slide.index + 1} / {slide.total}
            {slide.deckSlide ? ` / Deck slide ${slide.deckSlide}` : ""}
          </div>
          {hasWheelInteraction && (
            <div className="slide-wheel-overlay">
              <div className="slide-wheel-pointer" aria-hidden="true" />
              <div
                className="slide-wheel"
                style={{
                  "--wheel-rotation": `${wheelRotation}deg`,
                  "--wheel-spin-rotation": `${-wheelRotation}deg`,
                  background: `conic-gradient(${wheelGradient})`,
                }}
              >
                {wheelOptions.map((option, index) => (
                  <span
                    key={option.label}
                    className="slide-wheel-label"
                    style={{
                      "--label-angle": `${index * wheelSliceDegrees + wheelSliceDegrees / 2}deg`,
                    }}
                  >
                    <span>{option.label}</span>
                  </span>
                ))}
                <button
                  type="button"
                  className="slide-wheel-spin"
                  onClick={handleWheelSpin}
                  disabled={typing || isRecording || wheelSpinning || wheelResultPending || Boolean(landedWheelResult)}
                  aria-label={landedWheelResult ? `Wheel landed on ${landedWheelResult.label}` : "Spin the question wheel"}
                >
                  Spin
                </button>
              </div>
            </div>
          )}
          {exerciseVideo && (
            <div className="slide-video-overlay">
              <div className="slide-video-ready">
                <p className="slide-video-eyebrow">Seated exercise</p>
                <h1>Ready to move?</h1>
                <p>Please sit comfortably and safely on a sturdy chair before starting.</p>
                <small>
                  Only do movements that feel comfortable. {exerciseVideo.completionPrompt}
                </small>
              </div>
              <div className="slide-video-frame-shell">
                <iframe
                  className="slide-video-frame"
                  src={`https://www.youtube-nocookie.com/embed/${exerciseVideo.videoId}?playsinline=1&rel=0`}
                  title="Seated exercise follow-along video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            </div>
          )}
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

        <aside className="session-side-panel" aria-label="Session conversation">
          <div className="session-focus-panel">
            <span>Now discussing</span>
            <strong>{slide.title}</strong>
            {slide.prompt && <p>{slide.prompt}</p>}
          </div>
          <div className="session-transcript" ref={scrollRef} aria-live="polite">
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
          </div>
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
          disabled={sessionInputDisabled && !isRecording}
          title={pipelineMode === "openai-fast-scripted" ? "Recorded transcription with streaming scripted responses" : undefined}
        >
          {isRecording ? (
            // Stop square
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          ) : (
            // Microphone
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
          )}
        </button>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && sendMessage(input)}
          placeholder="Type your response..."
          className="chat-input"
          disabled={sessionInputDisabled}
        />
        <button type="button" onClick={() => sendMessage(input)} className="send-btn" aria-label="Send" disabled={sessionInputDisabled}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </footer>
    </div>
  );
}

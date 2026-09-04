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
const lipSyncModes = [
  { id: "rhubarb", label: "Rhubarb (precise)" },
  { id: "energy", label: "Audio energy (faster)" },
];
const wheelColors = ["#7A9DAD", "#F47C20", "#A8C5A0", "#4472C4", "#F4C8B0"];
const INACTIVITY_TIMEOUT_MS = 60_000;
const SESSION_END_DELAY_MS = 10_000;
const MIN_RECORDING_MS = 700;
const RECORDING_TAIL_MS = 250;
const SPOTIFY_IFRAME_API_URL = "https://open.spotify.com/embed/iframe-api/v1";
const YOUTUBE_IFRAME_API_URL = "https://www.youtube.com/iframe_api";

let spotifyIframeApi = null;
let spotifyIframeApiPromise = null;
let youtubeIframeApiPromise = null;

function loadSpotifyIframeApi() {
  if (spotifyIframeApi) return Promise.resolve(spotifyIframeApi);
  if (spotifyIframeApiPromise) return spotifyIframeApiPromise;

  spotifyIframeApiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => {
        spotifyIframeApiPromise = null;
        reject(new Error("Spotify player took too long to load"));
      },
      10000
    );

    window.onSpotifyIframeApiReady = (api) => {
      window.clearTimeout(timeout);
      spotifyIframeApi = api;
      resolve(api);
    };

    const handleScriptError = () => {
      window.clearTimeout(timeout);
      spotifyIframeApiPromise = null;
      reject(new Error("Spotify player could not be loaded"));
    };
    const handleScriptLoad = () => {
      if (!spotifyIframeApi) return;
      window.clearTimeout(timeout);
      resolve(spotifyIframeApi);
    };
    const existingScript = document.querySelector(`script[src="${SPOTIFY_IFRAME_API_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", handleScriptLoad, { once: true });
      existingScript.addEventListener("error", handleScriptError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SPOTIFY_IFRAME_API_URL;
    script.async = true;
    script.addEventListener("load", handleScriptLoad, { once: true });
    script.addEventListener("error", handleScriptError, { once: true });
    document.body.appendChild(script);
  });

  return spotifyIframeApiPromise;
}

function loadYouTubeIframeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeIframeApiPromise) return youtubeIframeApiPromise;

  youtubeIframeApiPromise = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      youtubeIframeApiPromise = null;
      reject(new Error("YouTube player took too long to load"));
    }, 10000);

    window.onYouTubeIframeAPIReady = () => {
      window.clearTimeout(timeout);
      resolve(window.YT);
    };

    const handleScriptError = () => {
      window.clearTimeout(timeout);
      youtubeIframeApiPromise = null;
      reject(new Error("YouTube player could not be loaded"));
    };
    const handleScriptLoad = () => {
      if (!window.YT?.Player) return;
      window.clearTimeout(timeout);
      resolve(window.YT);
    };
    const existingScript = document.querySelector(`script[src="${YOUTUBE_IFRAME_API_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", handleScriptLoad, { once: true });
      existingScript.addEventListener("error", handleScriptError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = YOUTUBE_IFRAME_API_URL;
    script.async = true;
    script.addEventListener("load", handleScriptLoad, { once: true });
    script.addEventListener("error", handleScriptError, { once: true });
    document.body.appendChild(script);
  });

  return youtubeIframeApiPromise;
}

function getInitialAvatarMode(defaultAvatarMode = "male") {
  if (import.meta.env.DEV) {
    const requestedMode = new URLSearchParams(window.location.search).get("avatar");
    if (avatarModeIds.has(requestedMode)) return requestedMode;
  }
  return avatarModeIds.has(defaultAvatarMode) ? defaultAvatarMode : "male";
}

function formatPlaybackDuration(seconds) {
  if (seconds === 60) return "one minute";
  if (seconds > 60 && seconds % 60 === 0) return `${seconds / 60} minutes`;
  return `${seconds} seconds`;
}

function getUnavailableThemeSongMessage(themeSong) {
  if (themeSong?.reason === "explicit-content" && themeSong.candidate) {
    return `${themeSong.candidate.name} by ${themeSong.candidate.artistLabel} is marked explicit on Spotify, so it cannot be played in this session.`;
  }
  if (themeSong?.reason === "skipped") {
    return "You chose to continue without a theme song today.";
  }
  if (themeSong?.reason === "ambiguous-query" || themeSong?.reason === "missing-query") {
    return "A specific song title was not identified.";
  }
  if (themeSong?.reason === "no-match") {
    return `Spotify could not find a safe match for ${themeSong.query || "the requested song"}.`;
  }
  if (themeSong?.reason === "not-configured" || themeSong?.reason === "request-failed") {
    return "Spotify could not be reached when the song was requested.";
  }
  return "The requested song could not be prepared this time.";
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

const SESSION_META_LABELS = {
  cst_intro_reminiscence: "Introduction",
  cst_childhood: "Childhood",
  cst_physical_games: "Physical Games",
  cst_current_affairs: "Current Affairs",
};

export default function SessionPage({ sessionId, onEnd, userName, pipelineMode: initialPipelineMode = "free" }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [typing, setTyping] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionMetaLabel, setSessionMetaLabel] = useState("");
  const [slide, setSlide] = useState(defaultSlide);
  const [avatarMode, setAvatarMode] = useState(() => getInitialAvatarMode(defaultAvatarMode));
  const [lipSyncMode, setLipSyncMode] = useState("rhubarb");
  const [pendingPlay, setPendingPlay] = useState(false);
  const [avatarNarrationActive, setAvatarNarrationActive] = useState(false);
  const [autoAdvanceFailedSlideId, setAutoAdvanceFailedSlideId] = useState(null);
  const [inactivityResetToken, setInactivityResetToken] = useState(0);
  const [currentAffairs, setCurrentAffairs] = useState(null);
  const [exercisePlayback, setExercisePlayback] = useState(null);
  const [videoPlaybackState, setVideoPlaybackState] = useState("idle");
  const [themeSong, setThemeSong] = useState(null);
  const [musicPlayback, setMusicPlayback] = useState(null);
  const [musicPlaybackState, setMusicPlaybackState] = useState("idle");
  const [questionWheel, setQuestionWheel] = useState(null);
  const [activityReveal, setActivityReveal] = useState(null);
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
  const recordingStartedAtRef = useRef(0);
  const recordingStopTimeoutRef = useRef(null);
  const voicePlaceholderIdRef = useRef(null);
  const wheelTimeoutRef = useRef(null);
  const wheelResultPendingRef = useRef(false);
  const slideIdRef = useRef(defaultSlide.id);
  const spotifyEmbedRef = useRef(null);
  const spotifyControllerRef = useRef(null);
  const spotifyPauseTimeoutRef = useRef(null);
  const spotifyAutoplayPendingRef = useRef(false);
  const videoMountRef = useRef(null);
  const videoPlayerRef = useRef(null);
  const videoReadyRef = useRef(false);
  const videoAutoplayPendingRef = useRef(false);
  const videoAutoplayFallbackRef = useRef(null);
  const avatarNarrationActiveRef = useRef(false);
  const playLiveAudioRef = useRef(null);
  const narrationQueueRef = useRef([]);
  const activeNarrationSegmentRef = useRef(null);
  const pendingSlideTransitionRef = useRef(null);
  const endAfterNarrationRef = useRef(false);
  const sessionEndTimeoutRef = useRef(null);
  const inactivityTimeoutRef = useRef(null);
  const inactivityRemindedRef = useRef(false);
  const inactivityRequestRef = useRef(null);
  const inactivityRequestControllersRef = useRef(new Set());
  const inactivityRequestGenerationRef = useRef(0);
  const activityRevisionRef = useRef(null);
  const assistantTurnRef = useRef(0);
  const autoAdvanceRequestedSlideRef = useRef(null);
  const autoAdvanceRetryCountRef = useRef(0);
  const requestAutomaticSlideAdvanceRef = useRef(null);
  const wheelOptions = slide.interaction?.type === "questionWheel" ? slide.interaction.options || [] : [];
  const hasWheelInteraction = wheelOptions.length > 0;
  const exerciseVideo = slide.interaction?.type === "youtubeShort" ? slide.interaction : null;
  const exerciseVideoId = exerciseVideo?.videoId || null;
  const exerciseAwaitingCompletion =
    Boolean(exerciseVideo) && exercisePlayback?.status !== "complete";
  const hasPositiveNewsInteraction = slide.interaction?.type === "positiveNews";
  const musicInteraction = slide.interaction?.type === "spotifySong" ? slide.interaction : null;
  const spotifyUri = themeSong?.status === "available" ? themeSong.track?.uri : null;
  const musicPlaybackSeconds = Number(musicInteraction?.playbackSeconds) || 30;
  const musicPlaybackDurationLabel = formatPlaybackDuration(musicPlaybackSeconds);
  const musicAwaitingCompletion =
    Boolean(musicInteraction) && musicPlayback?.status !== "complete";
  const autoAdvanceInteraction = slide.interaction?.type === "autoAdvance";
  const activityRevealInteraction =
    slide.interaction?.type === "activityReveal" ? slide.interaction : null;
  const activityOptions = activityRevealInteraction?.options || [];
  const hasActivityRevealInteraction = activityOptions.length > 0;
  const revealedActivityIds = new Set(activityReveal?.revealedOptionIds || []);
  const currentActivity = activityOptions.find(
    (option) => option.id === activityReveal?.currentOptionId
  );
  const activityTargetCount = activityReveal?.targetCount || activityRevealInteraction?.revealCount || 3;
  const inactivityTimeoutMs = Math.max(
    INACTIVITY_TIMEOUT_MS,
    Number(slide.inactivityTimeoutMs) || 0
  );
  const hasSlideInteraction =
    hasWheelInteraction ||
    Boolean(exerciseVideo) ||
    hasPositiveNewsInteraction ||
    Boolean(musicInteraction) ||
    hasActivityRevealInteraction;
  const landedWheelResult = questionWheel?.status === "landed" ? questionWheel : null;
  const sessionInputDisabled =
    typing ||
    wheelResultPending ||
    autoAdvanceInteraction ||
    hasActivityRevealInteraction ||
    avatarNarrationActive ||
    pendingPlay;
  const activityControlsDisabled =
    typing || isRecording || avatarNarrationActive || pendingPlay;
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
    if (inactivityTimeoutRef.current) window.clearTimeout(inactivityTimeoutRef.current);
    inactivityRequestGenerationRef.current += 1;
    inactivityRequestControllersRef.current.forEach((controller) => controller.abort());
    inactivityRequestControllersRef.current.clear();
    inactivityRequestRef.current = null;
  }, []);

  useEffect(() => () => {
    audioContextRef.current?.close();
  }, []);

  useEffect(() => () => {
    if (recordingStopTimeoutRef.current) window.clearTimeout(recordingStopTimeoutRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  }, []);

  useEffect(() => () => {
    if (sessionEndTimeoutRef.current) window.clearTimeout(sessionEndTimeoutRef.current);
  }, []);

  function commitSlide(slideData) {
    if (!slideData) return;
    if (slideData.id !== slideIdRef.current) {
      slideIdRef.current = slideData.id;
      autoAdvanceRequestedSlideRef.current = null;
      autoAdvanceRetryCountRef.current = 0;
      setAutoAdvanceFailedSlideId(null);
      setWheelSpinning(false);
      wheelResultPendingRef.current = false;
      setWheelResultPending(false);
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
      videoReadyRef.current = false;
      videoAutoplayPendingRef.current = false;
      if (videoAutoplayFallbackRef.current) {
        window.clearTimeout(videoAutoplayFallbackRef.current);
        videoAutoplayFallbackRef.current = null;
      }
      setVideoPlaybackState(
        slideData.interaction?.type === "youtubeShort" ? "loading" : "idle"
      );
    }
    setSlide(slideData);
  }

  function applyInteractionState(turn, slideData) {
    const shouldAutoplayThemeSong =
      slideData.interaction?.type === "spotifySong" &&
      turn.themeSong?.status === "available" &&
      turn.musicPlayback?.status !== "complete";
    const shouldAutoplayExercise =
      slideData.interaction?.type === "youtubeShort" &&
      turn.exercisePlayback?.status !== "complete";

    setCurrentAffairs(turn.currentAffairs || null);
    setExercisePlayback(turn.exercisePlayback || null);
    setThemeSong(turn.themeSong || null);
    setMusicPlayback(turn.musicPlayback || null);
    setMusicPlaybackState(
      turn.musicPlayback?.status === "complete"
        ? "complete"
        : turn.themeSong?.status === "available"
        ? "loading"
        : "idle"
    );
    setQuestionWheel(turn.questionWheel || null);
    setActivityReveal(turn.activityReveal || null);
    spotifyAutoplayPendingRef.current = shouldAutoplayThemeSong;
    videoAutoplayPendingRef.current = shouldAutoplayExercise;
  }

  function commitPendingSlideTransition() {
    const pendingTransition = pendingSlideTransitionRef.current;
    if (!pendingTransition?.to) return;

    commitSlide(pendingTransition.to);
    applyInteractionState(pendingTransition.turn, pendingTransition.to);
    pendingSlideTransitionRef.current = null;
  }

  function applyTurn(turn) {
    setSessionMetaLabel(SESSION_META_LABELS[turn.scriptId] || "");
    if (Number.isInteger(turn.activityRevision)) {
      activityRevisionRef.current = turn.activityRevision;
    }
    const slideData = turn.slide || defaultSlide;
    const deferredTransition = turn.slideTransition?.deferUntilAcknowledgementEnds
      ? turn.slideTransition
      : null;
    pendingSlideTransitionRef.current = deferredTransition
      ? { ...deferredTransition, turn }
      : null;
    commitSlide(deferredTransition?.from || slideData);
    if (!deferredTransition) applyInteractionState(turn, slideData);
    const audioSegments = Array.isArray(turn.avatar?.audio?.segments)
      ? turn.avatar.audio.segments.filter((segment) => segment?.url)
      : turn.avatar?.audio?.url
      ? [{
          url: turn.avatar.audio.url,
          rhubarbJson: turn.avatar?.lipsync?.rhubarbJson,
          advanceSlideAfter: false,
        }]
      : [];
    const hasAvatarNarration = audioSegments.length > 0;
    narrationQueueRef.current = audioSegments.slice(1);
    activeNarrationSegmentRef.current = audioSegments[0] || null;
    endAfterNarrationRef.current = Boolean(turn.sessionCompleteAfterResponse);
    avatarNarrationActiveRef.current = hasAvatarNarration;
    setAvatarNarrationActive(hasAvatarNarration);

    if (turn.assistantText) {
      const debugSuffix = import.meta.env.DEV
        ? ` [Step ${slideData.index + 1}/${slideData.total}: ${slideData.title}]`
        : "";
      setMessages((items) => [...items, { from: "avatar", text: turn.assistantText + debugSuffix }]);
      assistantTurnRef.current += 1;
      inactivityRemindedRef.current = false;
      setInactivityResetToken((value) => value + 1);
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
    if (audioSegments[0]) {
      const audioUrl = getBackendBase() + audioSegments[0].url;
      playLiveAudio(audioUrl, {
        rhubarbJson: audioSegments[0].rhubarbJson,
      });
    } else {
      commitPendingSlideTransition();
      finishNarrationSequence();
    }
  }

  async function playLiveAudio(audioUrl, { rhubarbJson } = {}) {
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
      } else {
        if (err.name !== "AbortError") {
          console.warn("Audio play error:", err.message);
        }
        handleAvatarAudioUnavailable();
      }
    }
  }

  playLiveAudioRef.current = playLiveAudio;

  function attemptSpotifyAutoplay() {
    if (
      !spotifyAutoplayPendingRef.current ||
      avatarNarrationActiveRef.current ||
      !spotifyControllerRef.current
    ) return;

    spotifyAutoplayPendingRef.current = false;
    try {
      spotifyControllerRef.current.play();
    } catch (error) {
      console.warn("Spotify autoplay was blocked:", error.message);
    }
  }

  function attemptVideoAutoplay() {
    if (
      !videoAutoplayPendingRef.current ||
      avatarNarrationActiveRef.current ||
      !videoReadyRef.current ||
      !videoPlayerRef.current
    ) return;

    videoAutoplayPendingRef.current = false;
    try {
      videoPlayerRef.current.playVideo();
      const checkAutoplay = (checksRemaining = 3) => {
        if (videoAutoplayFallbackRef.current) {
          window.clearTimeout(videoAutoplayFallbackRef.current);
        }
        videoAutoplayFallbackRef.current = window.setTimeout(() => {
          const player = videoPlayerRef.current;
          if (!player) return;
          const playerState = player.getPlayerState?.();
          if (playerState === window.YT?.PlayerState?.PLAYING) return;
          if (playerState === window.YT?.PlayerState?.BUFFERING && checksRemaining > 0) {
            checkAutoplay(checksRemaining - 1);
            return;
          }
          player.mute?.();
          player.playVideo?.();
          setVideoPlaybackState("playing-muted");
        }, 900);
      };
      checkAutoplay();
    } catch (error) {
      console.warn("YouTube autoplay was blocked:", error.message);
    }
  }

  function handleAvatarAudioEnded() {
    handleAudioPause();
    setPendingPlay(false);
    continueNarrationSequence();
  }

  function handleAvatarAudioUnavailable() {
    setPendingPlay(false);
    handleAudioPause();
    continueNarrationSequence();
  }

  function continueNarrationSequence() {
    const completedSegment = activeNarrationSegmentRef.current;
    if (completedSegment?.advanceSlideAfter && pendingSlideTransitionRef.current?.to) {
      commitPendingSlideTransition();
    }

    const nextSegment = narrationQueueRef.current.shift();
    activeNarrationSegmentRef.current = nextSegment || null;
    if (nextSegment) {
      avatarNarrationActiveRef.current = true;
      setAvatarNarrationActive(true);
      playLiveAudio(getBackendBase() + nextSegment.url, {
        rhubarbJson: nextSegment.rhubarbJson,
      });
      return;
    }

    if (pendingSlideTransitionRef.current?.to) {
      commitPendingSlideTransition();
    }
    finishNarrationSequence();
  }

  function finishNarrationSequence() {
    activeNarrationSegmentRef.current = null;
    narrationQueueRef.current = [];
    avatarNarrationActiveRef.current = false;
    setAvatarNarrationActive(false);
    attemptSpotifyAutoplay();
    attemptVideoAutoplay();
    if (endAfterNarrationRef.current && !sessionEndTimeoutRef.current) {
      sessionEndTimeoutRef.current = window.setTimeout(() => {
        sessionEndTimeoutRef.current = null;
        onEnd();
      }, SESSION_END_DELAY_MS);
    }
  }

  function invalidateInFlightInactivityReminder() {
    const hadInFlightRequest = Boolean(inactivityRequestRef.current);
    inactivityRequestGenerationRef.current += 1;
    inactivityRequestRef.current = null;
    return hadInFlightRequest;
  }

  function registerUserActivity() {
    if (inactivityTimeoutRef.current) {
      window.clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
    if (invalidateInFlightInactivityReminder()) {
      inactivityRemindedRef.current = false;
    }
    setInactivityResetToken((value) => value + 1);
  }

  async function requestAutomaticSlideAdvance() {
    const currentSlideId = slideIdRef.current;
    if (
      !sessionId ||
      slide.interaction?.type !== "autoAdvance" ||
      autoAdvanceRequestedSlideRef.current === currentSlideId
    ) return;

    autoAdvanceRequestedSlideRef.current = currentSlideId;
    setTyping(true);
    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: "[[auto-advance]]",
        avatarMode: avatarModeRef.current,
        lipSyncMode,
      });
      applyTurn(data);
      setAutoAdvanceFailedSlideId(null);
    } catch (err) {
      console.error("Failed to advance an automatic slide", err);
      autoAdvanceRetryCountRef.current += 1;
      if (autoAdvanceRetryCountRef.current < 3) {
        window.setTimeout(() => {
          if (slideIdRef.current === currentSlideId) {
            autoAdvanceRequestedSlideRef.current = null;
            setInactivityResetToken((value) => value + 1);
          }
        }, 1500);
      } else if (slideIdRef.current === currentSlideId) {
        autoAdvanceRequestedSlideRef.current = null;
        setAutoAdvanceFailedSlideId(currentSlideId);
      }
    } finally {
      setTyping(false);
    }
  }

  requestAutomaticSlideAdvanceRef.current = requestAutomaticSlideAdvance;

  useEffect(() => {
    if (
      !autoAdvanceInteraction ||
      typing ||
      avatarNarrationActive ||
      pendingPlay ||
      autoAdvanceFailedSlideId === slide.id ||
      autoAdvanceRequestedSlideRef.current === slide.id
    ) return undefined;

    const timer = window.setTimeout(
      () => requestAutomaticSlideAdvanceRef.current?.(),
      250
    );
    return () => window.clearTimeout(timer);
  }, [
    autoAdvanceInteraction,
    avatarNarrationActive,
    pendingPlay,
    autoAdvanceFailedSlideId,
    slide.id,
    typing,
    inactivityResetToken,
  ]);

  useEffect(() => {
    if (inactivityTimeoutRef.current) {
      window.clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }

    const inputExpected =
      assistantTurnRef.current > 0 &&
      !typing &&
      !isRecording &&
      !avatarNarrationActive &&
      !pendingPlay &&
      !wheelResultPending &&
      !wheelSpinning &&
      (!hasWheelInteraction || Boolean(landedWheelResult)) &&
      !exerciseAwaitingCompletion &&
      !musicAwaitingCompletion &&
      !autoAdvanceInteraction &&
      !inactivityRemindedRef.current;
    const expectedActivityRevision = activityRevisionRef.current;
    if (!sessionId || !inputExpected || !Number.isInteger(expectedActivityRevision)) {
      return undefined;
    }

    inactivityTimeoutRef.current = window.setTimeout(async () => {
      if (inactivityRemindedRef.current) return;
      inactivityRemindedRef.current = true;
      const requestGeneration = inactivityRequestGenerationRef.current + 1;
      inactivityRequestGenerationRef.current = requestGeneration;
      const controller = new AbortController();
      inactivityRequestControllersRef.current.add(controller);
      inactivityRequestRef.current = controller;

      try {
        const { data } = await api.post(`/sessions/${sessionId}/reminder`, {
          avatarMode: avatarModeRef.current,
          lipSyncMode,
          activityRevision: expectedActivityRevision,
        }, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const reminderText = data.messages?.assistant?.content || data.assistantText;
        if (reminderText) {
          setMessages((items) => [...items, { from: "avatar", text: reminderText }]);
        }

        const requestIsCurrent =
          !controller.signal.aborted &&
          requestGeneration === inactivityRequestGenerationRef.current &&
          data.activityRevision === expectedActivityRevision &&
          activityRevisionRef.current === expectedActivityRevision;
        if (!requestIsCurrent) return;
        const hasReminderNarration = Boolean(data.avatar?.audio?.url);
        avatarNarrationActiveRef.current = hasReminderNarration;
        setAvatarNarrationActive(hasReminderNarration);
        if (hasReminderNarration) {
          narrationQueueRef.current = [];
          pendingSlideTransitionRef.current = null;
          endAfterNarrationRef.current = false;
          activeNarrationSegmentRef.current = {
            url: data.avatar.audio.url,
            rhubarbJson: data.avatar?.lipsync?.rhubarbJson,
          };
          playLiveAudioRef.current?.(getBackendBase() + data.avatar.audio.url, {
            rhubarbJson: data.avatar?.lipsync?.rhubarbJson,
          });
        }
      } catch (err) {
        if (
          controller.signal.aborted ||
          requestGeneration !== inactivityRequestGenerationRef.current ||
          err.code === "ERR_CANCELED" ||
          err.name === "CanceledError" ||
          err.response?.status === 409
        ) return;
        console.error("Failed to request inactivity reminder", err);
        setMessages((items) => [
          ...items,
          {
            from: "avatar",
            text: "Take your time; there is no rush. Please think about the question I just asked. If you cannot think of an answer, feel free to say or type, ‘I don’t know.’",
          },
        ]);
      } finally {
        inactivityRequestControllersRef.current.delete(controller);
        if (inactivityRequestRef.current === controller) {
          inactivityRequestRef.current = null;
        }
      }
    }, inactivityTimeoutMs);

    return () => {
      if (inactivityTimeoutRef.current) {
        window.clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = null;
      }
    };
  }, [
    sessionId,
    typing,
    isRecording,
    avatarNarrationActive,
    pendingPlay,
    wheelResultPending,
    wheelSpinning,
    hasWheelInteraction,
    landedWheelResult,
    exerciseAwaitingCompletion,
    musicAwaitingCompletion,
    autoAdvanceInteraction,
    inactivityTimeoutMs,
    inactivityResetToken,
    lipSyncMode,
  ]);

  useEffect(() => {
    if (!sessionId || booted.current) return;
    booted.current = true;

    const startTurn = async () => {
      setTyping(true);
      try {
        const { data } = await api.post(`/sessions/${sessionId}/respond`, {
          content: "",
          avatarMode: avatarModeRef.current,
          lipSyncMode,
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

  useEffect(() => {
    const embedElement = spotifyEmbedRef.current;
    if (!musicAwaitingCompletion || !spotifyUri || !embedElement) {
      return undefined;
    }

    let cancelled = false;
    let controller = null;

    loadSpotifyIframeApi()
      .then((api) => {
        if (cancelled) return;
        api.createController(
          embedElement,
          {
            uri: spotifyUri,
            width: "100%",
            height: 152,
          },
          (embedController) => {
            if (cancelled) {
              embedController.destroy();
              return;
            }
            controller = embedController;
            spotifyControllerRef.current = embedController;
            setMusicPlaybackState("ready");

            embedController.addListener("playback_started", () => {
              spotifyAutoplayPendingRef.current = false;
              audioRef.current?.pause();
              if (spotifyPauseTimeoutRef.current) {
                window.clearTimeout(spotifyPauseTimeoutRef.current);
              }
              setMusicPlaybackState("playing");
              spotifyPauseTimeoutRef.current = window.setTimeout(() => {
                embedController.pause();
                setMusicPlaybackState("complete");
              }, musicPlaybackSeconds * 1000);
            });
            attemptSpotifyAutoplay();
          }
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.warn("Spotify embed error:", error.message);
          setMusicPlaybackState("error");
        }
      });

    return () => {
      cancelled = true;
      if (spotifyPauseTimeoutRef.current) {
        window.clearTimeout(spotifyPauseTimeoutRef.current);
        spotifyPauseTimeoutRef.current = null;
      }
      const activeController = controller || spotifyControllerRef.current;
      activeController?.pause();
      activeController?.destroy();
      if (spotifyControllerRef.current === activeController) {
        spotifyControllerRef.current = null;
      }
    };
  }, [musicAwaitingCompletion, musicPlaybackSeconds, spotifyUri]);

  useEffect(() => {
    const mountElement = videoMountRef.current;
    if (!exerciseVideoId || !exerciseAwaitingCompletion || !mountElement) {
      return undefined;
    }

    let cancelled = false;
    let player = null;
    videoReadyRef.current = false;
    mountElement.replaceChildren();
    const playerHost = document.createElement("div");
    playerHost.className = "slide-video-frame";
    mountElement.appendChild(playerHost);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        player = new YT.Player(playerHost, {
          videoId: exerciseVideoId,
          width: "100%",
          height: "100%",
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              if (cancelled) return;
              videoPlayerRef.current = event.target;
              videoReadyRef.current = true;
              setVideoPlaybackState("ready");
              attemptVideoAutoplay();
            },
            onStateChange: (event) => {
              if (cancelled) return;
              if (event.data === YT.PlayerState.PLAYING) {
                setVideoPlaybackState(event.target.isMuted?.() ? "playing-muted" : "playing");
              }
            },
          },
        });
      })
      .catch((error) => {
        if (!cancelled) console.warn("YouTube embed error:", error.message);
      });

    return () => {
      cancelled = true;
      videoReadyRef.current = false;
      if (videoAutoplayFallbackRef.current) {
        window.clearTimeout(videoAutoplayFallbackRef.current);
        videoAutoplayFallbackRef.current = null;
      }
      const activePlayer = player || videoPlayerRef.current;
      activePlayer?.stopVideo?.();
      activePlayer?.destroy?.();
      if (videoPlayerRef.current === activePlayer) {
        videoPlayerRef.current = null;
      }
      mountElement.replaceChildren();
    };
  }, [exerciseAwaitingCompletion, exerciseVideoId]);

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
    if (
      wheelResultPendingRef.current ||
      avatarNarrationActiveRef.current ||
      pendingPlay
    ) return;

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
        setIsRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(recordingChunksRef.current, { type: mimeType });
        await sendAudioToBackend(blob);
      };

      recorder.start(100);
      recordingStartedAtRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      mediaStreamRef.current = stream;
      setIsRecording(true);
    } catch (err) {
      setIsRecording(false);
      console.error("Failed to start recording:", err);
    }
  }

  function stopRecording() {
    if (recordingStopTimeoutRef.current || mediaRecorderRef.current?.state !== "recording") return;
    const elapsedRecordingMs = Date.now() - recordingStartedAtRef.current;
    const stopDelayMs = Math.max(RECORDING_TAIL_MS, MIN_RECORDING_MS - elapsedRecordingMs);
    recordingStopTimeoutRef.current = window.setTimeout(() => {
      recordingStopTimeoutRef.current = null;
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.requestData();
        mediaRecorderRef.current.stop();
      }
    }, stopDelayMs);
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
      formData.append("lipSyncMode", lipSyncMode);

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
    if (
      !isRecording &&
      (wheelResultPendingRef.current || avatarNarrationActiveRef.current || pendingPlay)
    ) return;
    registerUserActivity();

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
    registerUserActivity();

    setMessages((items) => [...items, { from: "user", text: content }]);
    setInput("");
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content,
        avatarMode: avatarModeRef.current,
        lipSyncMode,
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

  async function handleMusicDone() {
    if (typing || !musicAwaitingCompletion) return;

    if (spotifyPauseTimeoutRef.current) {
      window.clearTimeout(spotifyPauseTimeoutRef.current);
      spotifyPauseTimeoutRef.current = null;
    }
    spotifyAutoplayPendingRef.current = false;
    spotifyControllerRef.current?.pause();
    setMusicPlaybackState("complete");
    setMessages((items) => [...items, { from: "user", text: "Done" }]);
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: "[[music-complete]]",
        avatarMode: avatarModeRef.current,
        lipSyncMode,
      });
      applyTurn(data);
    } catch (err) {
      console.error("Failed to complete music playback", err);
      setMusicPlaybackState(themeSong?.status === "available" ? "ready" : "idle");
      setMessages((items) => [
        ...items,
        {
          from: "avatar",
          text: "I could not continue just now. Please press Done again, or say or type done.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function handleExerciseDone() {
    if (typing || !exerciseAwaitingCompletion) return;

    videoAutoplayPendingRef.current = false;
    if (videoAutoplayFallbackRef.current) {
      window.clearTimeout(videoAutoplayFallbackRef.current);
      videoAutoplayFallbackRef.current = null;
    }
    videoPlayerRef.current?.stopVideo?.();
    setMessages((items) => [...items, { from: "user", text: "Done" }]);
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: "[[video-complete]]",
        avatarMode: avatarModeRef.current,
        lipSyncMode,
      });
      applyTurn(data);
    } catch (err) {
      console.error("Failed to complete exercise video", err);
      videoAutoplayPendingRef.current = true;
      setMessages((items) => [
        ...items,
        {
          from: "avatar",
          text: "I could not continue just now. Please press Done again, or say or type done.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function handleActivityReveal(option) {
    if (
      !option ||
      activityControlsDisabled ||
      activityReveal?.status === "performing" ||
      revealedActivityIds.has(option.id)
    ) return;

    registerUserActivity();
    setMessages((items) => [...items, { from: "user", text: `Reveal ${option.label}.` }]);
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: `[[activity-reveal:${JSON.stringify({ optionId: option.id })}]]`,
        avatarMode: avatarModeRef.current,
        lipSyncMode,
      });
      applyTurn(data);
    } catch (err) {
      console.error("Failed to reveal activity", err);
      setMessages((items) => [
        ...items,
        { from: "avatar", text: "I could not reveal that activity just now. Please try again." },
      ]);
    } finally {
      setTyping(false);
    }
  }

  async function handleActivityDone() {
    if (!currentActivity || activityControlsDisabled) return;

    registerUserActivity();
    setMessages((items) => [
      ...items,
      { from: "user", text: `I have finished ${currentActivity.label}.` },
    ]);
    setTyping(true);

    try {
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: "[[activity-complete]]",
        avatarMode: avatarModeRef.current,
        lipSyncMode,
      });
      applyTurn(data);
    } catch (err) {
      console.error("Failed to complete activity", err);
      setMessages((items) => [
        ...items,
        {
          from: "avatar",
          text: "I could not continue just now. Please press the finished button again.",
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
        lipSyncMode,
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
      });
      setMessages((items) => [
        ...items,
        { from: "avatar", text: `Skipped to slide ${targetSlide} for testing.` },
      ]);
      const { data } = await api.post(`/sessions/${sessionId}/respond`, {
        content: "",
        avatarMode: avatarModeRef.current,
        lipSyncMode,
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
        <div className="session-meta">
          {sessionMetaLabel ? `${sessionMetaLabel} / ` : ""}{formatElapsed(elapsed)}
        </div>
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
          className={`ppt-slide${slide.imageUrl && !hasSlideInteraction ? " has-slide-image" : ""}${hasSlideInteraction ? " has-slide-interaction" : ""}${exerciseVideo ? " has-video-interaction" : ""}${hasPositiveNewsInteraction ? " has-news-interaction" : ""}${musicInteraction ? " has-music-interaction" : ""}${hasActivityRevealInteraction ? " has-activity-reveal-interaction" : ""}`}
          style={{
            "--slide-accent": slide.accent || theme.blush,
            backgroundImage: slide.imageUrl && !hasSlideInteraction ? `url(${slide.imageUrl})` : undefined,
          }}
        >
          <div className="ppt-slide-progress">
            Session step {slide.index + 1} / {slide.total}
            {slide.deckSlide ? ` / Deck slide ${slide.deckSlide}` : ""}
          </div>
          {hasActivityRevealInteraction && (
            <div className="slide-activity-overlay">
              <header className="slide-activity-heading">
                <div>
                  <p>Reveal and re-enact</p>
                  <h1>3-2-1 Action!</h1>
                </div>
                <strong>
                  {Math.min(activityReveal?.completedCount || 0, activityTargetCount)} of {activityTargetCount} complete
                </strong>
              </header>
              <div className="slide-activity-grid">
                {activityOptions.map((option) => {
                  const isRevealed = revealedActivityIds.has(option.id);
                  const isCurrent = currentActivity?.id === option.id;
                  return (
                    <button
                      type="button"
                      key={option.id}
                      className={`slide-activity-card${isRevealed ? " is-revealed" : ""}${isCurrent ? " is-current" : ""}`}
                      onClick={() => handleActivityReveal(option)}
                      disabled={
                        activityControlsDisabled ||
                        activityReveal?.status === "performing" ||
                        isRevealed ||
                        (activityReveal?.completedCount || 0) >= activityTargetCount
                      }
                      aria-label={isRevealed ? `${option.label} revealed` : `Reveal ${option.label}`}
                    >
                      <img src={option.gifUrl} alt={`${option.label} movement demonstration`} />
                      <span className="slide-activity-cover">
                        <span>{option.label}</span>
                        {!isRevealed && <small>Reveal</small>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <footer className="slide-activity-footer" aria-live="polite">
                {currentActivity ? (
                  <>
                    <p><strong>{currentActivity.label}:</strong> {currentActivity.movementCue}</p>
                    <button
                      type="button"
                      className="slide-activity-done"
                      onClick={handleActivityDone}
                      disabled={activityControlsDisabled}
                    >
                      I have finished this action
                    </button>
                  </>
                ) : (
                  <p>Choose an unrevealed black card. Move only in ways that feel safe and comfortable.</p>
                )}
              </footer>
            </div>
          )}
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
                <div className="slide-video-status" aria-live="polite">
                  {videoPlaybackState === "loading" && "Loading the exercise..."}
                  {videoPlaybackState === "ready" && "Ready to start after Aria finishes."}
                  {videoPlaybackState === "playing" && "Exercise playing."}
                  {videoPlaybackState === "playing-muted" &&
                    "Exercise playing muted. Use the player volume control for sound."}
                </div>
                <button
                  type="button"
                  className="slide-media-done"
                  onClick={handleExerciseDone}
                  disabled={typing}
                >
                  Done
                </button>
              </div>
              <div className="slide-video-frame-shell">
                <div className="slide-video-player-mount" ref={videoMountRef} />
              </div>
            </div>
          )}
          {hasPositiveNewsInteraction && (
            <div className={`slide-news-overlay${currentAffairs?.article?.imageUrl ? " has-news-image" : ""}`}>
              <article className="slide-news-story">
                <p className="slide-news-eyebrow">Positive news from Aotearoa</p>
                {currentAffairs?.status === "available" ? (
                  <>
                    <h1>{currentAffairs.article.title}</h1>
                    <div className="slide-news-meta">
                      <span>{currentAffairs.article.source}</span>
                      {currentAffairs.article.publishedAt && (
                        <time dateTime={currentAffairs.article.publishedAt}>
                          {new Intl.DateTimeFormat("en-NZ", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            timeZone: "Pacific/Auckland",
                          }).format(new Date(currentAffairs.article.publishedAt))}
                        </time>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <h1>A gentle news pause</h1>
                    <p className="slide-news-summary">
                      {currentAffairs?.message ||
                        "No clearly positive New Zealand story is available right now."}
                    </p>
                  </>
                )}
              </article>
              {currentAffairs?.article?.imageUrl && (
                <figure className="slide-news-image">
                  <img src={currentAffairs.article.imageUrl} alt="" />
                  <figcaption>{currentAffairs.article.source}</figcaption>
                </figure>
              )}
            </div>
          )}
          {musicInteraction && (
            <div className="slide-music-overlay">
              {!musicAwaitingCompletion ? (
                <section className="slide-music-reflection">
                  <p className="slide-music-eyebrow">Looking back</p>
                  <h1>What would you like to remember?</h1>
                  <p>
                    Take your time and choose one part of today&apos;s conversation that stands
                    out to you.
                  </p>
                </section>
              ) : themeSong?.status === "available" ? (
                <>
                  <figure className="slide-music-artwork">
                    {themeSong.track.artwork ? (
                      <img
                        src={themeSong.track.artwork}
                        alt={`Album artwork for ${themeSong.track.album || themeSong.track.name}`}
                      />
                    ) : (
                      <div className="slide-music-artwork-fallback" aria-hidden="true" />
                    )}
                  </figure>
                  <section className="slide-music-details">
                    <p className="slide-music-eyebrow">Your theme song</p>
                    <h1>{themeSong.track.name}</h1>
                    <p className="slide-music-artist">{themeSong.track.artistLabel}</p>
                    <p className="slide-music-instruction">
                      The music will start when Aria finishes speaking. If your browser blocks it,
                      press Spotify's play button below.
                    </p>
                    <div
                      className={`slide-spotify-embed is-${musicPlaybackState}`}
                      ref={spotifyEmbedRef}
                    />
                    <p className="slide-music-status" aria-live="polite">
                      {musicPlaybackState === "loading" && "Loading your song..."}
                      {musicPlaybackState === "ready" && "Ready when you are."}
                      {musicPlaybackState === "playing" &&
                        `Playing for up to ${musicPlaybackDurationLabel}.`}
                      {musicPlaybackState === "complete" &&
                        `Music paused after ${musicPlaybackDurationLabel}.`}
                      {musicPlaybackState === "error" && "Spotify could not load this time."}
                    </p>
                    <div className="slide-music-actions">
                      <button
                        type="button"
                        className="slide-media-done"
                        onClick={handleMusicDone}
                        disabled={typing}
                      >
                        Done
                      </button>
                    </div>
                  </section>
                </>
              ) : (
                <section className="slide-music-unavailable">
                  <p className="slide-music-eyebrow">Your theme song</p>
                  <h1>We could not prepare the music this time</h1>
                  <p>{getUnavailableThemeSongMessage(themeSong)}</p>
                  <p>Your conversation summary is still ready to enjoy together.</p>
                  <button
                    type="button"
                    className="slide-media-done"
                    onClick={handleMusicDone}
                    disabled={typing}
                  >
                    Done
                  </button>
                </section>
              )}
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
            {autoAdvanceFailedSlideId === slide.id && (
              <div className="session-bubble avatar">
                <span>I could not move to the next slide automatically.</span>
                <button
                  type="button"
                  onClick={() => {
                    autoAdvanceRetryCountRef.current = 0;
                    setAutoAdvanceFailedSlideId(null);
                    requestAutomaticSlideAdvanceRef.current?.();
                  }}
                >
                  Retry
                </button>
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
            <select
              value={lipSyncMode}
              onChange={(event) => setLipSyncMode(event.target.value)}
              aria-label="Lip-sync mode"
              disabled={avatarMode === "visualizer"}
            >
              {lipSyncModes.map((mode) => (
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
            onEnded={handleAvatarAudioEnded}
            onError={handleAvatarAudioUnavailable}
            onSeeked={() => publishLipSyncFrame(Boolean(audioRef.current && !audioRef.current.paused))}
            preload="auto"
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
          disabled={(sessionInputDisabled || avatarNarrationActive || pendingPlay) && !isRecording}
          title={
            avatarNarrationActive || pendingPlay
              ? "Please wait until Aria finishes speaking"
              : pipelineMode === "openai-fast-scripted"
              ? "Recorded transcription"
              : undefined
          }
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
          onChange={(event) => {
            setInput(event.target.value);
            registerUserActivity();
          }}
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

import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import api from "./services/api.js";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import SessionPage from "./pages/SessionPage";
import EndPage from "./pages/EndPage";
import CaregiverPage from "./pages/CaregiverPage";
import SettingsPage from "./pages/SettingsPage";
import { toTitleCase } from "./utils/formatName";
import { LanguageProvider } from "./language/LanguageContext.jsx";

const DEFAULT_USER_SETTINGS = { personality: "default", language: "en", avatarMode: "male" };

const devParams = new URLSearchParams(window.location.search);
const devSessionEnabled = import.meta.env.DEV && devParams.get("devSession") === "1";
const pipelineModes = new Set(["free", "openai-fast-scripted"]);
const getInitialPipelineMode = () => {
  const requestedMode = devParams.get("pipeline");
  return pipelineModes.has(requestedMode) ? requestedMode : "free";
};

const AUTH_STORAGE_KEY = "avatarcst.auth";

function loadStoredAuth() {
  try {
    const parsed = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY));
    if (!parsed?.userId || !parsed?.userName) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeAuth(userId, userName) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ userId, userName }));
  } catch {
    // Storage may be unavailable (private browsing, quota) — refresh persistence just degrades.
  }
}

function clearAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private browsing, quota) — nothing to clean up in that case.
  }
}

const TEST_SESSIONS = [
  {
    id: "cst_intro_reminiscence",
    label: "Session 1",
    title: "Introduction & Welcome",
    theme: "Introduction",
  },
  {
    id: "cst_childhood",
    label: "Session 2",
    title: "Getting to Know You: Childhood",
    theme: "Childhood",
  },
  {
    id: "cst_physical_games",
    label: "Session 3",
    title: "Physical Games",
    theme: "Physical Games",
  },
  ...Array.from({ length: 12 }, (_, i) => {
    const n = i + 4;
    return {
      id: `placeholder_session_${n}`,
      label: `Session ${n}`,
      title: "Coming soon",
      theme: "",
      disabled: true,
    };
  }),
];

// Rehydrates the pipeline mode a session actually started with, since a page
// refresh loses the in-memory value chosen on the landing page.
function SessionRoute({ userName, fallbackPipelineMode, defaultAvatarMode, onSessionEnd }) {
  const { sessionId } = useParams();
  const [pipelineMode, setPipelineMode] = useState(fallbackPipelineMode);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    if (sessionId === "dev-session") return undefined;
    let cancelled = false;
    api.get(`/sessions/${sessionId}`)
      .then(({ data }) => {
        if (!cancelled && data.pipelineMode) setPipelineMode(data.pipelineMode);
      })
      .catch(() => { if (!cancelled) setInvalid(true); });
    return () => { cancelled = true; };
  }, [sessionId]);

  if (invalid) return <Navigate to="/landing" replace />;

  return (
    <SessionPage
      key={sessionId}
      sessionId={sessionId}
      onEnd={() => onSessionEnd(sessionId)}
      userName={userName}
      pipelineMode={pipelineMode}
      defaultAvatarMode={defaultAvatarMode}
    />
  );
}

function EndRoute({ userId, userName }) {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  return (
    <EndPage
      onHome={() => navigate("/landing")}
      userName={userName}
      sessionId={sessionId}
      userId={userId}
    />
  );
}

export default function App() {
  const navigate = useNavigate();
  const storedAuth = devSessionEnabled ? null : loadStoredAuth();
  const [userId, setUserId] = useState(devSessionEnabled ? "dev-user" : storedAuth?.userId ?? null);
  const [userName, setUserName] = useState(devSessionEnabled ? "Ryan" : storedAuth?.userName ?? "");
  const [selectedPipelineMode, setSelectedPipelineMode] = useState(getInitialPipelineMode);
  const [userSettings, setUserSettings] = useState(DEFAULT_USER_SETTINGS);

  useEffect(() => {
    if (!userId || devSessionEnabled) return;
    let cancelled = false;
    api.get(`/users/${userId}`)
      .then(({ data }) => {
        if (!cancelled && data.settings) {
          setUserSettings({ ...DEFAULT_USER_SETTINGS, ...data.settings });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const handleSettingsChange = (partial) => {
    setUserSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleLogin = (id, name) => {
    const titled = toTitleCase(name);
    setUserId(id);
    setUserName(titled);
    setUserSettings(DEFAULT_USER_SETTINGS);
    storeAuth(id, titled);
    navigate("/landing");
  };

  const handleStartSession = async (sessionOption = TEST_SESSIONS[0]) => {
    if (!userId || sessionOption.disabled) return;
    try {
      const { data } = await api.post("/sessions", {
        userId,
        title: sessionOption.title,
        theme: sessionOption.theme,
        scriptId: sessionOption.id,
        pipelineMode: selectedPipelineMode,
      });
      navigate(`/session/${data._id}`);
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  const handleEndSession = async (sessionId) => {
    try {
      await api.patch(`/sessions/${sessionId}/end`);
    } catch (err) {
      console.error("Failed to end session", err);
    }
    navigate(`/end/${sessionId}`);
  };

  const handleLogout = () => {
    clearAuth();
    setUserId(null);
    setUserName("");
    setUserSettings(DEFAULT_USER_SETTINGS);
    navigate("/login", { replace: true });
  };

  return (
    <LanguageProvider language={userSettings.language}>
      <Routes>
        <Route
          path="/"
          element={
            <Navigate
              to={
                devSessionEnabled
                  ? { pathname: "/session/dev-session", search: window.location.search }
                  : { pathname: userId ? "/landing" : "/login" }
              }
              replace
            />
          }
        />
        <Route
          path="/login"
          element={userId ? <Navigate to="/landing" replace /> : <LoginPage onLogin={handleLogin} />}
        />
        <Route
          path="/landing"
          element={
            userId ? (
              <LandingPage
                onStart={handleStartSession}
                onCaregiver={() => navigate("/caregiver/summary")}
                onSettings={() => navigate("/settings")}
                userName={userName}
                userId={userId}
                sessionOptions={TEST_SESSIONS}
                pipelineMode={selectedPipelineMode}
                onPipelineModeChange={setSelectedPipelineMode}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            userId ? (
              <SessionRoute
                userName={userName}
                fallbackPipelineMode={selectedPipelineMode}
                defaultAvatarMode={userSettings.avatarMode}
                onSessionEnd={handleEndSession}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/end/:sessionId"
          element={userId ? <EndRoute userId={userId} userName={userName} /> : <Navigate to="/login" replace />}
        />
        <Route path="/caregiver" element={<Navigate to="/caregiver/summary" replace />} />
        <Route
          path="/caregiver/:tab"
          element={
            userId ? (
              <CaregiverPage
                userId={userId}
                onBack={() => navigate("/landing")}
                onLogout={handleLogout}
                userName={userName}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            userId ? (
              <SettingsPage
                userId={userId}
                userName={userName}
                settings={userSettings}
                onBack={() => navigate("/landing")}
                onSettingsChange={handleSettingsChange}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={userId ? "/landing" : "/login"} replace />} />
      </Routes>
    </LanguageProvider>
  );
}

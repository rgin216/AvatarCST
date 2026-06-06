import { useState } from "react";
import api from "./services/api.js";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import SessionPage from "./pages/SessionPage";
import EndPage from "./pages/EndPage";
import CaregiverPage from "./pages/CaregiverPage";

const SCREENS = {
  LOGIN: "login",
  LANDING: "landing",
  SESSION: "session",
  END: "end",
  CAREGIVER: "caregiver",
};

const devParams = new URLSearchParams(window.location.search);
const devSessionEnabled = import.meta.env.DEV && devParams.get("devSession") === "1";

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
];

export default function App() {
  const [screen, setScreen] = useState(devSessionEnabled ? SCREENS.SESSION : SCREENS.LOGIN);
  const [userId, setUserId] = useState(devSessionEnabled ? "dev-user" : null);
  const [userName, setUserName] = useState(devSessionEnabled ? "Ryan" : "");
  const [sessionId, setSessionId] = useState(devSessionEnabled ? "dev-session" : null);

  const handleLogin = (id, name) => {
    setUserId(id);
    setUserName(name);
    setScreen(SCREENS.LANDING);
  };

  const handleStartSession = async (sessionOption = TEST_SESSIONS[0]) => {
    if (!userId) return;
    try {
      const { data } = await api.post("/sessions", {
        userId,
        title: sessionOption.title,
        theme: sessionOption.theme,
        scriptId: sessionOption.id,
      });
      setSessionId(data._id);
      setScreen(SCREENS.SESSION);
    } catch (err) {
      console.error("Failed to start session", err);
    }
  };

  const handleEndSession = async () => {
    if (sessionId) {
      try {
        await api.patch(`/sessions/${sessionId}/end`);
      } catch (err) {
        console.error("Failed to end session", err);
      }
    }
    setSessionId(null);
    setScreen(SCREENS.END);
  };

  return (
    <>
      {screen === SCREENS.LOGIN && <LoginPage onLogin={handleLogin} />}
      {screen === SCREENS.LANDING && (
        <LandingPage
          onStart={handleStartSession}
          onCaregiver={() => setScreen(SCREENS.CAREGIVER)}
          userName={userName}
          userId={userId}
          sessionOptions={TEST_SESSIONS}
        />
      )}
      {screen === SCREENS.SESSION && (
        <SessionPage sessionId={sessionId} onEnd={handleEndSession} userName={userName} />
      )}
      {screen === SCREENS.END && <EndPage onHome={() => setScreen(SCREENS.LANDING)} userName={userName} />}
      {screen === SCREENS.CAREGIVER && (
        <CaregiverPage userId={userId} onBack={() => setScreen(SCREENS.LANDING)} userName={userName} />
      )}
    </>
  );
}

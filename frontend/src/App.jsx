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

export default function App() {
  const [screen, setScreen] = useState(SCREENS.LOGIN);
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState("");
  const [sessionId, setSessionId] = useState(null);

  const handleLogin = (id, name) => {
    setUserId(id);
    setUserName(name);
    setScreen(SCREENS.LANDING);
  };

  const handleStartSession = async () => {
    if (!userId) return;
    try {
      const { data } = await api.post("/sessions", {
        userId,
        title: "CST Session",
        theme: "Reminiscence",
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

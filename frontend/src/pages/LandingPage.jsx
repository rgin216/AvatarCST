import { useState, useEffect, useRef } from "react";
import api from "../services/api.js";
import EvaluationControls from '../components/EvaluationControls.jsx';
import LandingTour from "../components/LandingTour.jsx";
import theme from "../utils/theme";
import useViewport from "../hooks/useViewport";
import { useLanguage } from "../language/useLanguage.js";

const pipelineOptions = [
  { id: "free", label: "Free", detail: "Groq + streamed Edge TTS" },
  { id: "openai-fast-scripted", label: "OpenAI fast", detail: "Script-locked streaming" },
];

const cardPalette = [
  { chip: `linear-gradient(135deg, ${theme.sage}, ${theme.sageDark})`, icon: "🌿", accent: theme.sageDark },
  { chip: `linear-gradient(135deg, ${theme.mist}, ${theme.mistDark})`, icon: "🧭", accent: theme.mistDark },
  { chip: `linear-gradient(135deg, ${theme.blush}, ${theme.rose})`, icon: "🏅", accent: theme.rose },
  { chip: `linear-gradient(135deg, ${theme.rose}, ${theme.warm})`, icon: "🎵", accent: theme.warm },
];

const navIconPaths = {
  help: <><circle cx="12" cy="12" r="9.5" /><path d="M9.3 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.7 2.5-2.7 2.5" /><path d="M12 16.8h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>,
  caregiver: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
};

function NavIcon({ name }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {navIconPaths[name]}
    </svg>
  );
}

const fallbackSessions = [
  { id: "cst_intro_reminiscence", label: "Session 1", title: "Introduction & Welcome", theme: "Introduction" },
];

export default function LandingPage({
  onStart,
  onCaregiver,
  onSettings,
  userName,
  userId,
  sessionOptions = [],
  pipelineMode = "openai-fast-scripted",
  onPipelineModeChange = () => {},
  evaluationSelection = 'off',
  onEvaluationSelectionChange = () => {},
  startError = '',
  landingTourPending = false,
  onLandingTourComplete = () => {},
}) {
  const { isPhone, isTablet, isWide } = useViewport();
  const isDesktop = !isPhone;
  const { t, language } = useLanguage();
  const [lastSession, setLastSession] = useState(null);
  const [tourReplayOpen, setTourReplayOpen] = useState(false);
  const settingsButtonRef = useRef(null);
  const caregiverButtonRef = useRef(null);
  const sessionsRef = useRef(null);
  const tourTargets = { sessions: sessionsRef, settings: settingsButtonRef, caregiver: caregiverButtonRef };
  const [access, setAccess] = useState(null);
  const [accessAttempt, setAccessAttempt] = useState(0);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState("next");

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    api.get(`/sessions/user/${userId}`)
      .then(({ data }) => { if (!cancelled) setLastSession(data[0] || null); })
      .catch(() => {});
    api.get(`/sessions/user/${userId}/access`)
      .then(({ data }) => { if (!cancelled) setAccess({ userId, ...data }); })
      .catch(() => { if (!cancelled) setAccess({ userId, error: true }); });
    return () => { cancelled = true; };
  }, [userId, accessAttempt]);

  const getLastSessionMeta = (s) => {
    if (!s) return null;
    const date = new Date(s.startedAt || s.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    let dayLabel;
    if (date.toDateString() === now.toDateString()) dayLabel = t("common.today");
    else if (date.toDateString() === yesterday.toDateString()) dayLabel = t("common.yesterday");
    else dayLabel = date.toLocaleDateString(language, { weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString(language, { hour: "numeric", minute: "2-digit" });
    const durationMins = s.startedAt && s.endedAt
      ? Math.round((new Date(s.endedAt) - new Date(s.startedAt)) / 60000)
      : null;
    return { dayLabel, time, durationMins };
  };

  const timeOfDay = () => {
    const h = new Date().getHours();
    if (h < 12) return t("landing.greeting.morning");
    if (h < 17) return t("landing.greeting.afternoon");
    return t("landing.greeting.evening");
  };

  const currentAccess = access?.userId === userId ? access : null;
  const introductionLocked = !currentAccess || currentAccess.error || currentAccess.introductionRequired;
  const sessions = (sessionOptions.length ? sessionOptions : fallbackSessions).map(session => ({
    ...session,
    prerequisiteLocked: introductionLocked && session.id !== 'cst_intro_reminiscence',
    disabled: session.disabled || (introductionLocked && session.id !== 'cst_intro_reminiscence'),
  }));

  const lastSessionMeta = getLastSessionMeta(lastSession);
  const lastSessionCardIndex = lastSession ? sessions.findIndex((s) => s.id === lastSession.scriptId) : -1;
  const lastSessionOption = lastSessionCardIndex >= 0 ? sessions[lastSessionCardIndex] : null;
  const lastSessionPalette = lastSessionCardIndex >= 0 ? cardPalette[lastSessionCardIndex % cardPalette.length] : null;
  const defaultHeroChip = `linear-gradient(135deg, ${theme.sage}, ${theme.mist})`;
  const heroIcon = lastSession ? (lastSessionOption?.icon || lastSessionPalette?.icon || "🕰️") : "👋";
  const heroChip = lastSession ? (lastSessionPalette?.chip || defaultHeroChip) : defaultHeroChip;

  const contentMaxWidth = isWide ? 1180 : isTablet ? 860 : 480;

  // Phones stack three cards, tablets show a 2×2 grid, wide screens a row of three.
  const cardColumns = isWide ? 3 : isTablet ? 2 : 1;
  const pageSize = isTablet ? 4 : 3;
  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
  // Rotating a tablet changes the page size, so keep the page in range.
  const currentPage = Math.min(pageIndex, totalPages - 1);
  const pageStart = currentPage * pageSize;
  const visibleSessions = sessions.slice(pageStart, pageStart + pageSize);
  const goToPrevPage = () => {
    setPageDirection("prev");
    setPageIndex((p) => (Math.min(p, totalPages - 1) - 1 + totalPages) % totalPages);
  };
  const goToNextPage = () => {
    setPageDirection("next");
    setPageIndex((p) => (Math.min(p, totalPages - 1) + 1) % totalPages);
  };
  const showCarouselNav = totalPages > 1;
  const carouselArrow = (direction) => (
    <button
      type="button"
      onClick={direction === "prev" ? goToPrevPage : goToNextPage}
      aria-label={direction === "prev" ? "Show previous sessions" : "Show next sessions"}
      className="carousel-arrow"
      style={{ width: 44, height: 44, fontSize: 20, flexShrink: 0 }}
    >
      {direction === "prev" ? "‹" : "›"}
    </button>
  );
  const pageCounter = (
    <div style={{ fontSize: 13, fontWeight: 600, color: theme.textLight, minWidth: 72, textAlign: "center" }}>
      {pageStart + 1}–{Math.min(pageStart + pageSize, sessions.length)} of {sessions.length}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.cream }}>
      <div style={{
        position: "relative", overflow: "hidden", flexShrink: 0,
        background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, ${theme.blush}30 100%)`,
        paddingBottom: isDesktop ? 56 : 44,
      }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 380, height: 380, borderRadius: "50%", background: `radial-gradient(circle, ${theme.blush}55 0%, transparent 70%)`, pointerEvents: "none" }} />
        <div style={{ position: "absolute", top: "10%", left: -90, width: 260, height: 260, borderRadius: "50%", background: `radial-gradient(circle, ${theme.rose}30 0%, transparent 70%)`, pointerEvents: "none" }} />

        <div style={{
          maxWidth: contentMaxWidth,
          margin: "0 auto",
          padding: isWide ? "40px 56px 0" : isTablet ? "40px 40px 0" : "32px 20px 0",
          position: "relative",
        }}>
          <div className="fade-up" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 16,
            marginBottom: isDesktop ? 40 : 32,
          }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 38 : 30, fontWeight: 700, color: theme.text }}>AvatarCST</div>
              <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Your therapy companion</div>
            </div>
            {/* Phones: three equal tiles across the full width, icon above label. */}
            <div className={isPhone ? "landing-nav-tiles" : undefined} style={isPhone ? undefined : { display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setTourReplayOpen(true)}
                className="btn-outline btn-nav"
                title={t("tour.replay")}
              >
                <NavIcon name="help" />{t("tour.replay")}
              </button>
              <button ref={settingsButtonRef} onClick={onSettings} className="btn-outline btn-nav"><NavIcon name="settings" />{t("landing.settings")}</button>
              <button ref={caregiverButtonRef} onClick={onCaregiver} className="btn-outline btn-nav"><NavIcon name="caregiver" />{t("landing.caregiver")}</button>
            </div>
          </div>

          <div style={{
            display: isWide ? "grid" : "block",
            gridTemplateColumns: isWide ? "1.15fr 0.85fr" : undefined,
            columnGap: isWide ? 32 : undefined,
          }}>
            <div className="fade-up delay-1" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 15, color: theme.textLight, fontWeight: 500, marginBottom: 4 }}>{timeOfDay()},</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 40 : 34, fontWeight: 600, color: theme.text, lineHeight: 1.15 }}>{userName} 🌸</div>
              <div style={{ marginTop: 12, fontSize: 17, color: theme.textLight, lineHeight: 1.6 }}>{t("landing.readyForSession")}<br />{t("landing.exerciseMind")}</div>
            </div>

            <div className="fade-up delay-2" style={{
              background: theme.white, borderRadius: 24, padding: isPhone ? "20px 22px" : "26px 28px",
              marginTop: isWide ? 0 : 24,
              boxShadow: "0 10px 40px rgba(139,107,90,0.10)",
            }}>
              <div key={lastSession?._id || "welcome"} className="soft-fade-in" style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 52, height: 52, flexShrink: 0, background: heroChip, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
                {heroIcon}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {lastSession ? t("landing.lastSession") : t("landing.welcome")}
                </div>
                <div style={{ fontSize: 17, fontWeight: 700, color: theme.text, marginTop: 2 }}>
                  {lastSession ? (lastSession.title || t("landing.sessionFallback")) : t("landing.firstSession")}
                </div>
                {lastSession ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, background: theme.sand, borderRadius: 999, padding: "3px 10px" }}>
                      {lastSessionMeta.dayLabel} · {lastSessionMeta.time}
                    </span>
                    {lastSessionMeta.durationMins !== null && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, background: theme.sand, borderRadius: 999, padding: "3px 10px" }}>
                        {lastSessionMeta.durationMins} min{lastSessionMeta.durationMins === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 14, color: theme.textLight, marginTop: 4, lineHeight: 1.4 }}>
                    {t("landing.firstSessionHint")}
                  </div>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="panel-drop-in" style={{
        position: "relative", flex: 1,
        marginTop: isDesktop ? -32 : -20,
        background: `linear-gradient(180deg, ${theme.white} 0%, #E7EEF1 100%)`,
        borderRadius: isDesktop ? "40px 40px 0 0" : "26px 26px 0 0",
        boxShadow: "0 -14px 36px rgba(122,157,173,0.14)",
      }}>
        <div style={{
          maxWidth: contentMaxWidth,
          margin: "0 auto",
          padding: isWide ? "28px 56px 32px" : isTablet ? "28px 40px 32px" : "22px 20px 24px",
        }}>
          <div className="fade-up delay-3" style={{
            display: "flex", justifyContent: "space-between", alignItems: isDesktop ? "center" : "flex-start",
            flexWrap: "wrap", gap: 12, marginBottom: 16,
          }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {t("landing.yourSessions")}
            </div>
            <div style={{ display: "inline-flex", gap: 4, background: theme.sand, borderRadius: 999, padding: 4 }}>
              {pipelineOptions.map((option) => {
                const active = pipelineMode === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onPipelineModeChange(option.id)}
                    aria-pressed={active}
                    title={option.detail}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "7px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "'Nunito', sans-serif",
                      cursor: "pointer",
                      color: active ? theme.text : theme.textLight,
                      background: active ? theme.white : "transparent",
                      boxShadow: active ? "0 2px 10px rgba(139,107,90,0.15)" : "none",
                      transition: "all 0.15s",
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <EvaluationControls value={evaluationSelection} onChange={onEvaluationSelectionChange} />
          {startError && <p role="alert" className="landing-notice is-error">{startError}</p>}
          {currentAccess?.introductionRequired && <p role="status" className="landing-notice">🔒 Complete Session 1 fully to unlock all other sessions.</p>}
          {!currentAccess && <p role="status" className="landing-notice">Checking available sessions…</p>}
          {currentAccess?.error && (
            <p role="alert" className="landing-notice is-error">
              Could not check session access.
              <button type="button" className="btn-outline" onClick={() => setAccessAttempt(value => value + 1)}>Try again</button>
            </p>
          )}
          <div ref={sessionsRef} className="fade-up delay-4" style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {isWide && showCarouselNav && carouselArrow("prev")}

            <div
              key={`${currentPage}-${pageSize}`}
              className={pageDirection === "next" ? "carousel-slide-next" : "carousel-slide-prev"}
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: `repeat(${cardColumns}, minmax(0, 1fr))`,
                gap: isPhone ? 14 : 18,
              }}
            >
              {visibleSessions.map((session, i) => {
                const globalIndex = pageStart + i;
                const palette = session.disabled
                  ? { chip: `linear-gradient(135deg, #D9D2C8, #BFB6A8)`, icon: "🔒", accent: theme.textLight }
                  : { ...cardPalette[globalIndex % cardPalette.length], ...(session.icon ? { icon: session.icon } : {}) };
                return (
                  <button
                    key={session.id}
                    onClick={() => onStart(session)}
                    disabled={session.disabled}
                    className="session-card card-pop-in"
                    style={{
                      background: theme.white,
                      boxShadow: "0 6px 24px rgba(139,107,90,0.10)",
                      "--card-target-opacity": session.disabled ? 0.55 : 1,
                      cursor: session.disabled ? "default" : "pointer",
                      animationDelay: `${i * 60}ms`,
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: isTablet ? 52 : 44, height: isTablet ? 52 : 44, flexShrink: 0, borderRadius: 14, background: palette.chip, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isTablet ? 24 : 20 }}>
                          {palette.icon}
                        </div>
                        <div style={{ fontSize: isTablet ? 13 : 12, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {session.label}
                        </div>
                      </div>
                      <div className="session-card-title" title={session.title} style={{
                        fontWeight: 700, color: theme.text, lineHeight: 1.3,
                      }}>
                        {session.title}
                      </div>
                    </div>
                    <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: isTablet ? 15 : 13, fontWeight: 700, color: palette.accent }}>
                      {session.prerequisiteLocked ? 'Complete Session 1 to unlock' : session.disabled ? t("landing.comingSoon") : <>{t("landing.startSession")} <span aria-hidden="true">→</span></>}
                    </div>
                  </button>
                );
              })}
            </div>

            {isWide && showCarouselNav && carouselArrow("next")}
          </div>

          {showCarouselNav && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: isWide ? 14 : 18 }}>
              {!isWide && carouselArrow("prev")}
              {pageCounter}
              {!isWide && carouselArrow("next")}
            </div>
          )}
        </div>
      </div>

      {(landingTourPending || tourReplayOpen) && (
        <LandingTour
          userName={userName}
          targets={tourTargets}
          introductionLocked={Boolean(currentAccess?.introductionRequired)}
          onClose={() => {
            setTourReplayOpen(false);
            if (landingTourPending) onLandingTourComplete();
          }}
        />
      )}
    </div>
  );
}

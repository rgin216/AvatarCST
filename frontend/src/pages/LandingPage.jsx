import { useState, useEffect } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";
import { useLanguage } from "../language/useLanguage.js";

const pipelineOptions = [
  { id: "free", label: "Free", detail: "Groq + streamed Edge TTS" },
  { id: "openai-fast-scripted", label: "OpenAI fast", detail: "Script-locked streaming" },
];

const cardPalette = [
  { chip: `linear-gradient(135deg, ${theme.sage}, ${theme.sageDark})`, icon: "🌿", accent: theme.sageDark },
  { chip: `linear-gradient(135deg, ${theme.mist}, ${theme.mistDark})`, icon: "🧭", accent: theme.mistDark },
  { chip: `linear-gradient(135deg, ${theme.blush}, ${theme.rose})`, icon: "🏅", accent: theme.rose },
  { chip: `linear-gradient(135deg, ${theme.rose}, ${theme.warm})`, icon: "📖", accent: theme.warm },
];

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
  pipelineMode = "free",
  onPipelineModeChange = () => {},
}) {
  const isDesktop = useIsDesktop();
  const { t } = useLanguage();
  const [lastSession, setLastSession] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageDirection, setPageDirection] = useState("next");

  useEffect(() => {
    if (!userId) return;
    api.get(`/sessions/user/${userId}`)
      .then(({ data }) => { if (data.length > 0) setLastSession(data[0]); })
      .catch(() => {});
  }, [userId]);

  const getLastSessionMeta = (s) => {
    if (!s) return null;
    const date = new Date(s.startedAt || s.createdAt);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    let dayLabel;
    if (date.toDateString() === now.toDateString()) dayLabel = "Today";
    else if (date.toDateString() === yesterday.toDateString()) dayLabel = "Yesterday";
    else dayLabel = date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString("en-NZ", { hour: "numeric", minute: "2-digit" });
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

  const sessions = sessionOptions.length ? sessionOptions : fallbackSessions;

  const lastSessionMeta = getLastSessionMeta(lastSession);
  const lastSessionCardIndex = lastSession ? sessions.findIndex((s) => s.id === lastSession.scriptId) : -1;
  const lastSessionPalette = lastSessionCardIndex >= 0 ? cardPalette[lastSessionCardIndex % cardPalette.length] : null;
  const defaultHeroChip = `linear-gradient(135deg, ${theme.sage}, ${theme.mist})`;
  const heroIcon = lastSession ? (lastSessionPalette?.icon || "🕰️") : "👋";
  const heroChip = lastSession ? (lastSessionPalette?.chip || defaultHeroChip) : defaultHeroChip;

  const contentMaxWidth = isDesktop ? 1180 : 480;

  const pageSize = 3;
  const totalPages = Math.max(1, Math.ceil(sessions.length / pageSize));
  const pageStart = pageIndex * pageSize;
  const visibleSessions = sessions.slice(pageStart, pageStart + pageSize);
  const goToPrevPage = () => {
    setPageDirection("prev");
    setPageIndex((p) => (p - 1 + totalPages) % totalPages);
  };
  const goToNextPage = () => {
    setPageDirection("next");
    setPageIndex((p) => (p + 1) % totalPages);
  };

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
          padding: isDesktop ? "40px 56px 0" : "36px 28px 0",
          position: "relative",
        }}>
          <div className="fade-up" style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: isDesktop ? 40 : 32,
          }}>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 38 : 30, fontWeight: 700, color: theme.text }}>AvatarCST</div>
              <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>Your therapy companion</div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onSettings} className="btn-outline">⚙️ {t("landing.settings")}</button>
              <button onClick={onCaregiver} className="btn-outline">👨‍👩‍👧 {t("landing.caregiver")}</button>
            </div>
          </div>

          <div style={{
            display: isDesktop ? "grid" : "block",
            gridTemplateColumns: isDesktop ? "1.15fr 0.85fr" : undefined,
            columnGap: isDesktop ? 32 : undefined,
          }}>
            <div className="fade-up delay-1" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={{ fontSize: 15, color: theme.textLight, fontWeight: 500, marginBottom: 4 }}>{timeOfDay()},</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 40 : 34, fontWeight: 600, color: theme.text, lineHeight: 1.15 }}>{userName} 🌸</div>
              <div style={{ marginTop: 12, fontSize: 17, color: theme.textLight, lineHeight: 1.6 }}>{t("landing.readyForSession")}<br />{t("landing.exerciseMind")}</div>
            </div>

            <div className="fade-up delay-2" style={{
              background: theme.white, borderRadius: 24, padding: "26px 28px",
              marginTop: isDesktop ? 0 : 24,
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
                  {lastSession ? (lastSession.title || "Session") : t("landing.firstSession")}
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
          padding: isDesktop ? "28px 56px 32px" : "22px 28px 24px",
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

          <div className="fade-up delay-4" style={{ display: "flex", alignItems: "center", gap: isDesktop ? 14 : 8 }}>
            {totalPages > 1 && (
              <button
                type="button"
                onClick={goToPrevPage}
                aria-label="Show previous sessions"
                className="carousel-arrow"
                style={{ width: isDesktop ? 44 : 36, height: isDesktop ? 44 : 36, fontSize: 18, flexShrink: 0 }}
              >
                ‹
              </button>
            )}

            <div
              key={pageIndex}
              className={pageDirection === "next" ? "carousel-slide-next" : "carousel-slide-prev"}
              style={{
                flex: 1,
                display: "grid",
                gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "1fr",
                gap: 18,
              }}
            >
              {visibleSessions.map((session, i) => {
                const globalIndex = pageStart + i;
                const palette = session.disabled
                  ? { chip: `linear-gradient(135deg, #D9D2C8, #BFB6A8)`, icon: "🔒", accent: theme.textLight }
                  : cardPalette[globalIndex % cardPalette.length];
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
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                        <div style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 14, background: palette.chip, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>
                          {palette.icon}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {session.label}
                        </div>
                      </div>
                      <div style={{
                        fontSize: 18, fontWeight: 700, color: theme.text, lineHeight: 1.3,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}>
                        {session.title}
                      </div>
                      {session.theme && (
                        <div style={{ fontSize: 13, color: theme.textLight, marginTop: 6 }}>{session.theme}</div>
                      )}
                    </div>
                    <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: palette.accent }}>
                      {session.disabled ? t("landing.comingSoon") : <>{t("landing.startSession")} <span aria-hidden="true">→</span></>}
                    </div>
                  </button>
                );
              })}
            </div>

            {totalPages > 1 && (
              <button
                type="button"
                onClick={goToNextPage}
                aria-label="Show next sessions"
                className="carousel-arrow"
                style={{ width: isDesktop ? 44 : 36, height: isDesktop ? 44 : 36, fontSize: 18, flexShrink: 0 }}
              >
                ›
              </button>
            )}
          </div>

          {totalPages > 1 && (
            <div style={{ textAlign: "center", marginTop: 10, fontSize: 12, color: theme.textLight }}>
              {pageStart + 1}–{Math.min(pageStart + pageSize, sessions.length)} of {sessions.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

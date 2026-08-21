import { useState } from "react";
import api from "../services/api.js";
import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";
import { useLanguage } from "../language/useLanguage.js";
import { SUPPORTED_LANGUAGES } from "../language/translations.js";

export default function SettingsPage({ userId, userName, settings, onBack, onSettingsChange }) {
  const isDesktop = useIsDesktop();
  const { t } = useLanguage();
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);

  const personalityOptions = [
    { id: "default", label: t("settings.personality.default") },
    { id: "optimistic", label: t("settings.personality.optimistic") },
  ];

  const avatarOptions = [
    { id: "male", label: t("settings.avatar.male") },
    { id: "female", label: t("settings.avatar.female") },
    { id: "visualizer", label: t("settings.avatar.visualizer") },
  ];

  const applySetting = async (field, value) => {
    if (!userId || settings[field] === value) return;
    setSaving(field);
    setError(null);
    const previous = settings[field];
    onSettingsChange({ [field]: value });
    try {
      await api.patch(`/users/${userId}/settings`, { [field]: value });
    } catch (err) {
      console.error(`Failed to save ${field}`, err);
      onSettingsChange({ [field]: previous });
      setError(field);
    } finally {
      setSaving(null);
    }
  };

  const contentMaxWidth = isDesktop ? 720 : 480;

  const segmentedControl = (field, options) => (
    <div style={{ display: "inline-flex", flexWrap: "wrap", gap: 6, background: theme.sand, borderRadius: 999, padding: 4 }}>
      {options.map((option) => {
        const active = settings[field] === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => applySetting(field, option.id)}
            aria-pressed={active}
            disabled={saving === field}
            style={{
              border: "none",
              borderRadius: 999,
              padding: "9px 18px",
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "'Nunito', sans-serif",
              cursor: saving === field ? "default" : "pointer",
              color: active ? theme.text : theme.textLight,
              background: active ? theme.white : "transparent",
              boxShadow: active ? "0 2px 10px rgba(139,107,90,0.15)" : "none",
              opacity: saving === field ? 0.7 : 1,
              transition: "all 0.15s",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );

  const section = (titleKey, field, options) => (
    <div style={{ background: theme.white, borderRadius: 20, padding: "20px 22px", marginBottom: 16, boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: theme.textLight, textTransform: "uppercase", letterSpacing: "0.07em" }}>
          {t(titleKey)}
        </div>
        {saving === field && <div style={{ fontSize: 12, color: theme.textLight }}>{t("caregiver.loading")}</div>}
        {error === field && <div style={{ fontSize: 12, color: "#C0504D" }}>⚠</div>}
      </div>
      {segmentedControl(field, options)}
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: theme.cream }}>
      <div style={{
        position: "relative", overflow: "hidden", flexShrink: 0,
        background: `linear-gradient(160deg, ${theme.cream} 0%, ${theme.sand} 60%, ${theme.blush}30 100%)`,
        paddingBottom: isDesktop ? 40 : 32,
      }}>
        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto", padding: isDesktop ? "40px 32px 0" : "32px 24px 0" }}>
          <div className="fade-up" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer" }}>←</button>
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 30 : 26, fontWeight: 700, color: theme.text }}>
                {t("settings.title")}
              </div>
              {userName && <div style={{ fontSize: 13, color: theme.textLight, marginTop: 2 }}>{userName}</div>}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-drop-in" style={{
        position: "relative", flex: 1,
        marginTop: isDesktop ? -24 : -16,
        background: `linear-gradient(180deg, ${theme.white} 0%, #E7EEF1 100%)`,
        borderRadius: isDesktop ? "36px 36px 0 0" : "24px 24px 0 0",
        boxShadow: "0 -14px 36px rgba(122,157,173,0.14)",
      }}>
        <div style={{ maxWidth: contentMaxWidth, margin: "0 auto", padding: isDesktop ? "28px 32px 32px" : "22px 24px 24px" }}>
          {section("settings.personality", "personality", personalityOptions)}
          {section("settings.language", "language", SUPPORTED_LANGUAGES)}
          {section("settings.avatar", "avatarMode", avatarOptions)}
        </div>
      </div>
    </div>
  );
}

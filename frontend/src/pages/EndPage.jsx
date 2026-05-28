import theme from "../utils/theme";
import useIsDesktop from "../hooks/useIsDesktop";
import EmojiButton from "../components/ui/EmojiButton";

export default function EndPage({ onHome, userName }) {
  const isDesktop = useIsDesktop();
  const stats = [
    { label: "Duration", value: "18 mins", icon: "⏱️" },
    { label: "Topics Covered", value: "4", icon: "💬" },
    { label: "Engagement", value: "High", icon: "⭐" },
    { label: "Mood", value: "Happy", icon: "😊" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${theme.cream}, ${theme.sand})`, padding: "48px 28px 40px" }}>
      <div style={{ maxWidth: isDesktop ? 700 : 480, margin: "0 auto" }}>
        <div className="fade-up" style={{ textAlign: "center", marginBottom: 36 }}>
          <div className="avatar-float" style={{ fontSize: 64, marginBottom: 16 }}>🌟</div>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: isDesktop ? 36 : 32, fontWeight: 600, color: theme.text }}>Great session, {userName}!</div>
          <div style={{ fontSize: 16, color: theme.textLight, marginTop: 8, lineHeight: 1.6 }}>You did wonderfully today.<br />Keep up the wonderful work!</div>
        </div>

        <div className="fade-up delay-1" style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(4, 1fr)" : "1fr 1fr", gap: 12, marginBottom: 28 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: theme.white, borderRadius: 18, padding: "20px 16px", textAlign: "center", boxShadow: "0 4px 20px rgba(139,107,90,0.08)" }}>
              <div style={{ fontSize: 26, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: theme.text }}>{s.value}</div>
              <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="fade-up delay-2" style={{ background: theme.white, borderRadius: 20, padding: "20px 22px", marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: theme.textLight, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Session Highlights</div>
          {["Discussed childhood memories from the garden 🌼", "Completed 3 word association rounds", "Shared a favourite song from the 1960s 🎵"].map((h, i, arr) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < arr.length - 1 ? 12 : 0, fontSize: 15, color: theme.text, lineHeight: 1.5 }}>
              <span style={{ color: theme.sageDark, fontWeight: 700, marginTop: 1 }}>✓</span>{h}
            </div>
          ))}
        </div>

        <div className="fade-up delay-3" style={{ background: `linear-gradient(135deg, ${theme.blush}44, ${theme.rose}22)`, borderRadius: 20, padding: "20px 22px", marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 14 }}>How did today's session feel?</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            {["😞", "😐", "🙂", "😊", "😄"].map((e, i) => <EmojiButton key={i} emoji={e} />)}
          </div>
        </div>

        <div className="fade-up delay-4" style={{ display: "flex", gap: 12 }}>
          <button onClick={onHome} className="btn-outline" style={{ flex: 1, padding: "16px", fontSize: 16 }}>← Home</button>
          <button onClick={onHome} className="btn-primary" style={{ flex: 2 }}>Book Next Session ▸</button>
        </div>
      </div>
    </div>
  );
}

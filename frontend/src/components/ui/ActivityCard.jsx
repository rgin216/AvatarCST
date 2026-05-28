import { useState } from "react";
import theme from "../../utils/theme";

export default function ActivityCard({ activity }) {
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => setActive(!active)} style={{
      background: active ? `linear-gradient(135deg, ${theme.blush}88, ${theme.rose}55)` : theme.white,
      border: `2px solid ${active ? theme.rose : "transparent"}`,
      borderRadius: 18, padding: "18px 14px", cursor: "pointer", textAlign: "left",
      fontFamily: "'Nunito', sans-serif",
      boxShadow: active ? `0 4px 20px ${theme.rose}33` : "0 2px 12px rgba(139,107,90,0.07)",
      transition: "all 0.2s",
    }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{activity.icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>{activity.label}</div>
      <div style={{ fontSize: 12, color: theme.textLight, marginTop: 2 }}>{activity.desc}</div>
    </button>
  );
}

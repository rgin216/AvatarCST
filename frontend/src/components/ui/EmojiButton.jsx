import { useState } from "react";
import theme from "../../utils/theme";

export default function EmojiButton({ emoji }) {
  const [active, setActive] = useState(false);
  return (
    <button onClick={() => setActive(!active)} style={{
      width: 48, height: 48, borderRadius: 14,
      background: active ? theme.white : "transparent",
      border: `2px solid ${active ? "#E8A090" : "transparent"}`,
      fontSize: 26, cursor: "pointer", transition: "all 0.15s",
      boxShadow: active ? "0 4px 16px #E8A09044" : "none",
    }}>{emoji}</button>
  );
}

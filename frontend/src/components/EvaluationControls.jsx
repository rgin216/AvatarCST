import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function EvaluationControls({ value, onChange }) {
  const [options, setOptions] = useState(null);
  useEffect(() => {
    let cancelled = false;
    api.get("/sessions/evaluation-options").then(({ data }) => { if (!cancelled) setOptions(data); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  if (!options?.available) return null;
  return <details style={{ marginBottom: 18, padding: 14, background: "#fff", borderRadius: 12 }}>
    <summary>Research evaluation</summary>
    <p>Keep one facilitator for the whole session. The other models review the conversation after it ends.</p>
    <label>Facilitator{" "}
      <select aria-label="Evaluation facilitator" value={value} onChange={event => onChange(event.target.value)}>
        <option value="off">Evaluation off</option>
        <option value="rotate">Rotate automatically between sessions</option>
        {options.models.map(model => <option key={model.id} value={model.id}>{model.id}</option>)}
      </select>
    </label>
    {value !== "off" && <p>Evaluation records the conversation for review. Scores describe the application, not the participant or clinical benefit.</p>}
  </details>;
}

import { useEffect, useState } from "react";
import api from "../services/api.js";

export default function SessionEvaluationReport({ sessionId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let cancelled = false, timer;
    const poll = async () => {
      try {
        const response = await api.get(`/sessions/${sessionId}/evaluation`);
        if (cancelled) return;
        setData(response.data);
        setError("");
        if (["queued", "running", "collecting"].includes(response.data.status)) timer = setTimeout(poll, 5000);
      } catch { if (!cancelled) setError("Evaluation status could not be loaded."); }
    };
    void poll();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [sessionId, revision]);
  if (!data && !error || data?.status === "disabled") return null;
  const retry = async () => {
    try { await api.post(`/sessions/${sessionId}/evaluation/retry`); setRevision(r => r + 1); }
    catch { setError("Could not queue evaluation. Please try again."); }
  };
  return <section style={{ padding: 18, marginBottom: 20, borderRadius: 16, background: "#fff" }} aria-label="Session evaluation">
    <h3>Research evaluation</h3>
    <p>Facilitator: {data?.assignment?.facilitator?.id || "Loading"}</p>
    <p role="status">{error || ({ collecting: "Waiting for the session to end.", queued: "Critiques queued.", running: "Models are reviewing the session.", complete: "Review complete.", failed: "Review needs attention." }[data?.status])}</p>
    {data?.report && <>
      <p>{data.report.naturalCompletion ? "The scripted session reached its ending." : "This session ended before the scripted ending."}</p>
      <p>{data.report.turnCount} turns · {data.report.failedModelCalls} failed model calls · {data.report.recordedFallbacks || 0} recorded fallbacks · {data.report.forcedProgressCount} forced progressions</p>
      {data.report.judgments.map(j => <details key={j.judge}>
        <summary>{j.judge}{j.status === "error" ? " — critique unavailable" : ""}</summary>
        {j.status === "ok" ? <>
          <div style={{ overflowX: 'auto' }}><table><thead><tr><th>Criterion</th><th>Score / 5</th><th>Evidence</th></tr></thead>
            <tbody>{Object.entries(j.result.scores).map(([key, item]) => <tr key={key}><td>{key.replaceAll("_", " ")}</td><td>{item.score}</td><td>{item.evidence}</td></tr>)}</tbody>
          </table></div>
          {j.result.criticalFailures.map((failure, index) => <p key={index}>{failure.reason}: {failure.evidence}</p>)}
        </> : <p>The provider could not return a valid critique.</p>}
      </details>)}
      <p>These ratings evaluate the application and are not a clinical outcome measure.</p>
    </>}
    {(data?.status === "failed" || data?.status === "collecting") && <button type="button" onClick={retry}>Retry evaluation</button>}
    {error && <button type="button" onClick={() => setRevision(r => r + 1)}>Refresh status</button>}
  </section>;
}

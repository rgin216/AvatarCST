import { useEffect, useRef, useState } from 'react';
import api from '../services/api.js';
import { deploymentLatency, latencyCsv } from '../utils/deploymentLatency.js';

function download(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function DeploymentLatencyControls({ sessionId, avatarMode, lipSyncMode, busy, applyTurn, onRequestState }) {
  const [visible] = useState(() => new URLSearchParams(window.location.search).get('latency') === '1');
  const [enabled, setEnabled] = useState(false);
  const [running, setRunning] = useState(false);
  const [inputs, setInputs] = useState('My name is Alex.\nI enjoy gardening.\nI am not sure.');
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState('');
  const busyRef = useRef(busy);
  const abortRef = useRef(null);
  useEffect(() => { busyRef.current = busy; }, [busy]);
  useEffect(() => () => { abortRef.current?.abort(); deploymentLatency.enable(false); }, []);
  if (!visible) return null;

  async function run() {
    const lines = inputs.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
    const items = files.length ? files : lines;
    if (!items.length || items.length > 100) { setStatus('Choose 1–100 synthetic inputs.'); return; }
    const controller = new AbortController(); abortRef.current = controller; setRunning(true);
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    try {
      for (let i = 0; i < items.length; i++) {
        const waitStart = performance.now();
        while (busyRef.current) {
          if (controller.signal.aborted) return;
          if (performance.now() - waitStart > 180000) throw new Error('Playback wait timed out. Check the audio play button.');
          await pause(100);
        }
        if (controller.signal.aborted) return;
        setStatus(`Running input ${i + 1}/${items.length}`);
        let body;
        const audio = items[i] instanceof File;
        if (audio) {
          body = new FormData(); body.append('audio', items[i]); body.append('avatarMode', avatarMode); body.append('lipSyncMode', lipSyncMode);
        } else body = { content: items[i], avatarMode, lipSyncMode };
        onRequestState(true);
        let turn;
        try {
          const response = await api.post(`/sessions/${sessionId}/${audio ? 'respond-audio' : 'respond'}`, body,
            { signal: controller.signal, timeout: 120000 });
          turn = response.data; applyTurn(turn);
        } finally { onRequestState(false); }
        if (turn.sessionCompleteAfterResponse) { setStatus('Session completed; no further inputs sent.'); return; }
        // Let React commit the narration state before checking the next input.
        await pause(500);
      }
      setStatus('All inputs submitted. Wait for final playback before exporting.');
    } catch (error) { setStatus(controller.signal.aborted ? 'Stopped. Export retained attempts.' : error.message); }
    finally { setRunning(false); abortRef.current = null; }
  }

  function exportData() {
    const rows = deploymentLatency.snapshot();
    const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
    download(`deployed-latency-${stamp}.json`, JSON.stringify({ schemaVersion: 1,
      scope: 'deployed-browser-request-to-media-playing', exportedAt: new Date().toISOString(),
      frontendUrl: location.origin + location.pathname, backendUrl: api.defaults.baseURL,
      userAgent: navigator.userAgent, rows }, null, 2), 'application/json');
    download(`deployed-latency-${stamp}.csv`, latencyCsv(rows), 'text/csv');
    setStatus(`Exported ${rows.length} attempts.`);
  }

  return <details style={{ background: '#fff', padding: 12, marginBottom: 12 }}>
    <summary>Deployment latency research</summary>
    <p>Use a dedicated synthetic test account. Automated inputs advance this session and save messages on the server. Capture exports contain timings and session IDs, without transcripts or audio.</p>
    <label><input type="checkbox" checked={enabled} disabled={running} onChange={event => {
      setEnabled(event.target.checked); deploymentLatency.enable(event.target.checked);
    }} /> Capture latency for this session</label>
    <p>Enter one synthetic response per line, or select audio fixtures. Audio files replace the text list.</p>
    <textarea aria-label="Synthetic latency responses" value={inputs} disabled={running} onChange={event => setInputs(event.target.value)} style={{ width: '100%' }} />
    <input aria-label="Synthetic audio fixtures" type="file" accept="audio/*" multiple disabled={running} onChange={event => setFiles(Array.from(event.target.files))} />
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
      <button disabled={!enabled || running || busy} onClick={run}>Run synthetic inputs</button>
      <button disabled={!running} onClick={() => { abortRef.current?.abort(); setStatus('Stopping; an in-flight server turn may still complete.'); }}>Stop</button>
      <button onClick={exportData}>Export JSON + CSV</button>
      <button disabled={running || busy} onClick={() => { deploymentLatency.clear(); setStatus('Capture cleared.'); }}>Clear capture</button>
    </div>
    <p role="status">{status}</p>
  </details>;
}

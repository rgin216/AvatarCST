import { useEffect, useRef, useState } from 'react';
import './WordGamesActivity.css';

export default function PronunciationActivity({ interaction, sessionId, disabled, onActivity, onComplete }) {
  const storageKey = `pronunciation:${sessionId}`;
  const [heard, setHeard] = useState(() => {
    try { const value = JSON.parse(sessionStorage.getItem(storageKey)); return Array.isArray(value) ? value.filter(id => interaction.clips.some(c => c.id === id)) : []; } catch { return []; }
  });
  const [playing, setPlaying] = useState(null);
  const [error, setError] = useState('');
  const players = useRef({});
  const complete = interaction.clips.every(clip => heard.includes(clip.id));
  useEffect(() => {
    const audioElements = players.current;
    return () => Object.values(audioElements).forEach(audio => audio.pause());
  }, []);
  function finish(id) {
    setPlaying(null);
    setHeard(current => {
      const next = [...new Set([...current, id])];
      try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Continue with in-memory progress. */ }
      return next;
    });
    onActivity?.();
  }
  async function play(id) {
    onActivity?.();
    setError('');
    Object.values(players.current).forEach(audio => audio.pause());
    const audio = players.current[id];
    audio.currentTime = 0;
    try { await audio.play(); } catch { setPlaying(null); setError('The audio could not play. Please click the word again to retry.'); }
  }
  return <div className="word-games-activity">
    <h1>Common te reo Māori words</h1>
    <p>Click a word to listen, then try saying it aloud. You can listen again whenever you like.</p>
    <div className="pronunciation-grid">
      {interaction.clips.map(clip => <div key={clip.id}>
        <button className={`pronunciation-word${heard.includes(clip.id) ? ' is-heard' : ''}`} disabled={disabled} onClick={() => play(clip.id)} aria-label={`Listen to ${clip.label}, ${clip.meaning}${heard.includes(clip.id) ? ', already heard' : ''}`}>
          <strong>{clip.label}</strong><span>{clip.meaning}</span>
          <small>{playing === clip.id ? '▶ Playing…' : heard.includes(clip.id) ? '✓ Heard — play again' : '▶ Listen'}</small>
        </button>
        <audio ref={el => { if (el) players.current[clip.id] = el; }} src={clip.src} preload="none" onPlay={() => setPlaying(clip.id)} onPause={() => setPlaying(current => current === clip.id ? null : current)} onEnded={() => finish(clip.id)} onError={() => { setPlaying(null); setError(`Unable to load ${clip.label}. Please click it to retry.`); }} />
      </div>)}
    </div>
    <p role="status">{heard.length} of 6 words heard. {complete ? 'Well done. Continue when you are ready.' : 'Listen to all six to continue.'}</p>
    {error && <p role="alert">{error}</p>}
    <button disabled={disabled || !complete || Boolean(playing)} onClick={() => onComplete(`[[pronunciation-complete:${interaction.clips.map(c => c.id).join(',')}]]`, 'I have listened to all six words.')}>Continue</button>
  </div>;
}

import { useEffect, useRef } from 'react';
import './SessionPreparationNotice.css';

// Sits over the session page, which shows its first slide dimmed behind it.
export default function SessionPreparationNotice({ preparation, sessionTitle = 'Your session', onReady }) {
  const readyButton = useRef(null);
  useEffect(() => { readyButton.current?.focus(); }, []);
  const items = preparation.items || [];
  // The ready button is the only control, so keep keyboard focus on it rather
  // than letting Tab reach the session behind the notice.
  const keepFocus = event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    readyButton.current?.focus();
  };

  return <div className="session-preparation" role="dialog" aria-modal="true" aria-labelledby="preparation-title" aria-describedby="preparation-message" onKeyDown={keepFocus}>
    <section className="preparation-card">
      <span className="preparation-eyebrow">{sessionTitle}</span>
      <h2 id="preparation-title">{preparation.title || 'Before we begin'}</h2>
      <p id="preparation-message">{preparation.message}</p>
      {items.length > 0 && <ul className="preparation-items">
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>}
      {preparation.note && <p className="preparation-note">{preparation.note}</p>}
      <button ref={readyButton} type="button" className="preparation-ready" onClick={onReady}>
        {preparation.confirmLabel || 'I am ready'}
      </button>
    </section>
  </div>;
}

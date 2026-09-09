import { useId, useRef, useState } from 'react';
import './MatchingActivity.css';

export default function MatchingActivity({ interaction, title, disabled, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState({});
  const [pointer, setPointer] = useState(null);
  const [hovered, setHovered] = useState(null);
  const board = useRef(null);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const marker = useId().replace(/:/g, '');
  const { left, right } = interaction;
  const position = (event) => {
    const box = board.current.getBoundingClientRect();
    return { x: (event.clientX - box.left) / box.width * 100, y: (event.clientY - box.top) / box.height * 100 };
  };
  const targetAt = (event) => document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-match-target]')?.dataset.matchTarget;
  const connect = (source, target) => {
    if (disabled || source === null) return;
    setMatches((previous) => ({ ...Object.fromEntries(Object.entries(previous).filter(([key, value]) => key !== source && value !== target)), [source]: target }));
    setSelected(null);
    setPointer(null);
    setHovered(null);
  };
  const y = (index, count) => (index + 0.5) / count * 100;
  return <div className="matching-activity">
    <h1>{title}</h1>
    <p>Drag from a description to a name, or select a description and then a name. Select a description again to change its match.</p>
    <p className="matching-status" role="status">{selected !== null ? `Description ${left.findIndex((item) => item.id === selected) + 1} selected — choose a name.` : `${Object.keys(matches).length} of ${left.length} connected.`}</p>
    <div className="matching-board" ref={board}>
      <svg className="matching-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs><marker id={marker} markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto"><path d="M0,0 L4,2 L0,4" fill="#275f72" /></marker></defs>
        {Object.entries(matches).map(([source, target]) => <line key={source} x1="44" y1={y(left.findIndex((item) => item.id === source), left.length)} x2="60" y2={y(right.findIndex((item) => item.id === target), right.length)} markerEnd={`url(#${marker})`} />)}
        {pointer && selected !== null && <line className="matching-preview" x1="44" y1={y(left.findIndex((item) => item.id === selected), left.length)} x2={pointer.x} y2={pointer.y} markerEnd={`url(#${marker})`} />}
      </svg>
      <div className="matching-column">
        {left.map((item, index) => <button key={item.id} type="button" disabled={disabled} aria-pressed={selected === item.id} className={selected === item.id ? 'is-selected' : matches[item.id] ? 'is-connected' : ''}
          onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } setSelected(item.id); }}
          onKeyDown={(event) => { if (event.key === 'Escape') setSelected(null); }}
          onPointerDown={(event) => { if (event.button !== 0) return; suppressClick.current = false; drag.current = { source: item.id }; setSelected(item.id); event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={(event) => { if (!drag.current) return; setPointer(position(event)); setHovered(targetAt(event) || null); }}
          onPointerUp={(event) => { const active = drag.current; drag.current = null; setPointer(null); setHovered(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); const target = targetAt(event); if (active && target) { suppressClick.current = true; connect(active.source, target); event.preventDefault(); } }}
          onPointerCancel={() => { drag.current = null; setPointer(null); setHovered(null); }}>
          <span>{index + 1}. {item.label}</span><small>{matches[item.id] ? `Connected to ${right.find((option) => option.id === matches[item.id])?.label}` : 'Choose a name →'}</small>
        </button>)}
      </div>
      <div className="matching-column">
        {right.map((item) => <button key={item.id} type="button" data-match-target={item.id} disabled={disabled} className={hovered === item.id ? 'is-hovered' : Object.values(matches).includes(item.id) ? 'is-connected' : ''} onClick={() => connect(selected, item.id)}>{item.label}</button>)}
      </div>
    </div>
    <div className="matching-actions">
      <button type="button" disabled={disabled} onClick={() => { setMatches({}); setSelected(null); }}>Clear matches</button>
      <button type="button" disabled={disabled} onClick={() => onComplete(Object.keys(matches).length ? `My matches: ${left.filter((item) => matches[item.id]).map((item) => `${item.label} — ${right.find((option) => option.id === matches[item.id]).label}`).join('; ')}. I am done matching.` : 'I would like to skip matching.')}>{Object.keys(matches).length ? 'Done matching' : 'Skip matching'}</button>
    </div>
  </div>;
}

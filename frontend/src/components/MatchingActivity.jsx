import { useId, useLayoutEffect, useRef, useState } from 'react';
import './MatchingActivity.css';

export default function MatchingActivity({ interaction, title, disabled, submitDisabled, onActivity, onComplete }) {
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState({});
  const [reviewed, setReviewed] = useState(false);
  const [pointer, setPointer] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [geometry, setGeometry] = useState({ width: 1, height: 1, left: {}, right: {} });
  const board = useRef(null);
  const leftNodes = useRef({});
  const rightNodes = useRef({});
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const marker = useId().replace(/:/g, '');
  const { left, right } = interaction;
  useLayoutEffect(() => {
    const measure = () => {
      const rect = board.current.getBoundingClientRect();
      const points = (nodes, edge) => Object.fromEntries(Object.entries(nodes).filter(([, node]) => node).map(([id, node]) => {
        const box = node.getBoundingClientRect();
        return [id, { x: box[edge] - rect.left, y: box.top + box.height / 2 - rect.top }];
      }));
      setGeometry({ width: rect.width, height: rect.height, left: points(leftNodes.current, 'right'), right: points(rightNodes.current, 'left') });
    };
    measure();
    const observer = new ResizeObserver(measure);
    [board.current, ...Object.values(leftNodes.current), ...Object.values(rightNodes.current)].filter(Boolean).forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [interaction]);
  const position = (event) => {
    const rect = board.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const targetAt = (event) => {
    const node = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-match-target]');
    return node && board.current.contains(node) ? node.dataset.matchTarget : null;
  };
  const select = (id) => { if (!disabled) { setSelected(id); onActivity?.(); } };
  const connect = (source, target) => {
    if (disabled || source === null) return;
    setMatches((previous) => ({ ...Object.fromEntries(Object.entries(previous).filter(([key, value]) => key !== source && value !== target)), [source]: target }));
    setReviewed(false);
    setSelected(null);
    setPointer(null);
    setHovered(null);
    onActivity?.();
  };
  const correctCount = left.filter((item) => matches[item.id] === item.answerId).length;
  const result = (item) => !reviewed ? '' : matches[item.id] === item.answerId ? 'is-correct' : 'is-incorrect';
  return <div className="matching-activity">
    <header className="matching-heading"><h1>{title}</h1><p>Drag a clue to a name, or tap a clue then a name.</p></header>
    <p className="matching-status" role="status">{selected !== null ? `Clue ${left.findIndex((item) => item.id === selected) + 1} selected. Choose a name.` : reviewed ? `${correctCount} of ${left.length} correct. You can change a match or continue.` : `${Object.keys(matches).length} of ${left.length} connected.`}</p>
    <div className="matching-scroll">
      <div className="matching-board" ref={board}>
        <svg className="matching-arrows" viewBox={`0 0 ${geometry.width} ${geometry.height}`} aria-hidden="true">
          <defs>{['neutral', 'correct', 'incorrect'].map((kind) => <marker key={kind} id={`${marker}-${kind}`} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path d="M0,0 L8,4 L0,8" className={`arrow-${kind}`} /></marker>)}</defs>
          {Object.entries(matches).map(([source, target]) => {
            const from = geometry.left[source]; const to = geometry.right[target];
            const kind = !reviewed ? 'neutral' : left.find((item) => item.id === source)?.answerId === target ? 'correct' : 'incorrect';
            return from && to && <line key={source} className={`arrow-${kind}`} x1={from.x + 2} y1={from.y} x2={to.x - 4} y2={to.y} markerEnd={`url(#${marker}-${kind})`} />;
          })}
          {pointer && geometry.left[selected] && <line className="matching-preview" x1={geometry.left[selected].x + 2} y1={geometry.left[selected].y} x2={pointer.x} y2={pointer.y} markerEnd={`url(#${marker}-neutral)`} />}
        </svg>
        <div className="matching-column">
          {left.map((item, index) => <button key={item.id} ref={(node) => { leftNodes.current[item.id] = node; }} type="button" disabled={disabled} aria-pressed={selected === item.id} className={`${selected === item.id ? 'is-selected' : ''} ${result(item)}`}
            onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } select(item.id); }}
            onKeyDown={(event) => { if (event.key === 'Escape') setSelected(null); }}
            onPointerDown={(event) => { if (disabled || event.button !== 0) return; suppressClick.current = false; drag.current = item.id; select(item.id); event.currentTarget.setPointerCapture(event.pointerId); }}
            onPointerMove={(event) => { if (drag.current === null) return; setPointer(position(event)); setHovered(targetAt(event)); }}
            onPointerUp={(event) => { const source = drag.current; drag.current = null; setPointer(null); setHovered(null); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); const target = targetAt(event); if (source !== null && target) { suppressClick.current = true; connect(source, target); event.preventDefault(); } }}
            onPointerCancel={() => { drag.current = null; setPointer(null); setHovered(null); }}>
            <span>{index + 1}. {item.label}</span>
            <small>{reviewed ? matches[item.id] === item.answerId ? '✓ Correct' : `${matches[item.id] ? '✗ Incorrect' : 'Not matched'} — ${right.find((option) => option.id === item.answerId)?.label}` : matches[item.id] ? `→ ${right.find((option) => option.id === matches[item.id])?.label}` : 'Choose a name →'}</small>
          </button>)}
        </div>
        <div className="matching-column">
          {right.map((item) => <button key={item.id} ref={(node) => { rightNodes.current[item.id] = node; }} type="button" data-match-target={item.id} disabled={disabled} className={hovered === item.id ? 'is-hovered' : ''} onClick={() => connect(selected, item.id)}>{item.label}</button>)}
        </div>
      </div>
    </div>
    <footer className="matching-actions">
      <button type="button" disabled={disabled} onClick={() => { setMatches({}); setSelected(null); setReviewed(false); onActivity?.(); }}>Clear</button>
      {!reviewed ? <button type="button" disabled={disabled} onClick={() => { setReviewed(true); setSelected(null); onActivity?.(); }}>Check matches</button> : <button type="button" disabled={disabled || submitDisabled} onClick={() => onComplete(`[[matching:${JSON.stringify(matches)}]]`)}>Continue</button>}
    </footer>
  </div>;
}

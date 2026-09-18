import { useLayoutEffect, useRef, useState } from 'react';
import { fitObjectBoard } from '../utils/objectBoardLayout.js';
import './ObjectSelectionActivity.css';

const colour = index => `hsl(${(index * 137.508 + 210) % 360} 78% 37%)`;
export default function ObjectSelectionActivity({ slide, disabled, onActivity, onSubmit }) {
  const { interaction } = slide;
  const state = interaction.state || {};
  const odd = interaction.mode === 'odd';
  const [selected, setSelected] = useState([]);
  const [reason, setReason] = useState('');
  const [zoom, setZoom] = useState(false);
  const sending = useRef(false);
  const viewport = useRef(null);
  const [boardSize, setBoardSize] = useState(null);
  useLayoutEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setBoardSize(fitObjectBoard(width, height));
    });
    observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);
  const checked = odd && state.odd?.checked;
  const pairs = state.pairs || [];
  const names = ids => ids.map(id => interaction.items.find(item => item.id === id)?.label).filter(Boolean).join(' and ');
  async function submit(action, ids) {
    if (disabled || sending.current) return;
    sending.current = true;
    try {
      const ok = await onSubmit(`[[objects:${JSON.stringify({ stepId: slide.id, action, ...(ids ? { ids } : {}) })}]]`, action === 'done' ? 'I am ready to continue.' : `I selected ${names(ids) || 'no items'}.`);
      if (ok !== false) setSelected([]);
    } finally { sending.current = false; }
  }
  function select(id) {
    if (disabled || checked || sending.current) return;
    onActivity();
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...(!odd && selected.length === 2 ? [] : selected), id];
    setSelected(next);
    if (!odd && next.length === 2) submit('pair', next);
  }
  return <div className="object-activity">
    <div className="object-toolbar">
      <p>{odd ? (checked ? 'Selections checked — review the feedback below.' : 'Circle the items that do not belong, then check.') : 'Choose two pictures. Many connections are possible; you can reuse an object.'}</p>
      <button type="button" onClick={() => { setZoom(!zoom); onActivity(); }}>{zoom ? 'Fit picture' : 'Enlarge picture'}</button>
    </div>
    <div ref={viewport} className={`object-scroll${zoom ? ' zoomed' : ''}`}>
      <div className={`object-board${zoom ? ' enlarged' : ''}`} style={!zoom && boardSize ? boardSize : undefined}>
        <img src={slide.imageUrl} alt={slide.title} draggable="false" />
        <svg viewBox="0 0 1280 720" aria-hidden="true" className="object-circles">
          {pairs.flatMap((pair, index) => pair.ids.map(id => {
            const [x,y,w,h] = interaction.items.find(item => item.id === id).bounds;
            const offset = (index % 4) * 3;
            return <g key={`${index}-${id}`}><ellipse cx={x+w/2} cy={y+h/2} rx={w/2+offset} ry={h/2+offset} fill="none" stroke={colour(index)} strokeWidth="4" /><text x={x+8+(index%4)*18} y={y+18} fill={colour(index)} stroke="white" strokeWidth="3" paintOrder="stroke" fontSize="18" fontWeight="bold">{index+1}</text></g>;
          }))}
        </svg>
        {interaction.items.map(item => {
          const [x,y,w,h] = item.bounds;
          const active = selected.includes(item.id) || (checked && state.odd.selected.includes(item.id));
          const correct = checked && state.odd.correct.includes(item.id);
          const wrong = checked && state.odd.wrong.includes(item.id);
          const missed = checked && state.odd.missed.includes(item.id);
          return <button type="button" key={item.id} aria-label={item.label} title={item.label} aria-pressed={active}
            disabled={disabled || checked} onClick={() => select(item.id)}
            className={`object-hit${active ? ' selected' : ''}${correct ? ' correct' : ''}${wrong ? ' wrong' : ''}${missed ? ' missed' : ''}`}
            style={{ left:`${x/12.8}%`, top:`${y/7.2}%`, width:`${w/12.8}%`, height:`${h/7.2}%` }} />;
        })}
      </div>
    </div>
    <div className="object-controls">
      <span role="status">{selected.length ? `Selected: ${names(selected)}` : checked ? 'Green: correct. Orange: food. Dashed blue: other non-food items.' : odd ? 'No items selected yet.' : `${pairs.length} ${pairs.length === 1 ? 'pair' : 'pairs'} explored`}</span>
      <button type="button" disabled={disabled} onClick={() => odd && !checked ? submit('check', selected) : !odd && selected.length === 2 ? submit('pair', selected) : submit('done')}>
        {odd ? checked ? 'Continue' : 'Check selections' : selected.length === 2 ? 'Check pair' : 'Done'}
      </button>
    </div>
    {checked && <div className="object-feedback" aria-live="polite">
      <p>Correctly circled: {names(state.odd.correct) || 'none this time'}.</p>
      {state.odd.wrong.length > 0 && <p>These are food: {names(state.odd.wrong)}.</p>}
      {state.odd.missed.length > 0 && <p>Other non-food items: {names(state.odd.missed)}.</p>}
      <p>The items that do not belong are non-food items. There is no need for a perfect score.</p>
    </div>}
    {!odd && state.pendingPair && <form className="object-reason" onSubmit={async e => {
      e.preventDefault(); if (!reason.trim() || disabled || sending.current) return;
      sending.current = true;
      try { const ok = await onSubmit(reason.trim()); if (ok !== false) setReason(''); } finally { sending.current = false; }
    }}>
      <label htmlFor="pair-reason">What connects {names(state.pendingPair)}? You can also tell Aria aloud.</label>
      <input id="pair-reason" maxLength={500} value={reason} disabled={disabled} onChange={e => {setReason(e.target.value); onActivity();}} />
      <button disabled={disabled || !reason.trim()}>Share connection</button>
    </form>}
    {!odd && pairs.length > 0 && <details className="object-pair-history"><summary>Your pairs ({pairs.length})</summary><ol className="object-pair-list" aria-label="Your pairs">{pairs.map((pair,index) => <li key={index} style={{borderColor:colour(index)}}>{index+1}. {names(pair.ids)} — {pair.reason}</li>)}</ol></details>}
  </div>;
}


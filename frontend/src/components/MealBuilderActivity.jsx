import { useRef, useState } from 'react';
import './MealBuilderActivity.css';

// Pointer Events unify mouse, touch, and pen, so this drag works the same on
// mobile and desktop without separate touch handlers (same technique as
// MatchingActivity). Tapping a card is a full alternative to dragging it,
// since precise dragging can be hard - drag and tap both add the same way.
const DRAG_THRESHOLD_PX = 6;

export default function MealBuilderActivity({ interaction, title, disabled, submitDisabled, onActivity, onComplete }) {
  const [plate, setPlate] = useState([]);
  const [dragId, setDragId] = useState(null);
  const [pointer, setPointer] = useState(null);
  const [overPlate, setOverPlate] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const board = useRef(null);
  const suppressClick = useRef(false);
  const dragStart = useRef(null);
  const { cards = [], maxItems = 3 } = interaction;
  const locked = disabled || submitted || submitting;

  const position = (event) => {
    const rect = board.current.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const isOverPlate = (event) =>
    Boolean(document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-plate-drop]'));
  const passedDragThreshold = (event) => {
    if (!dragStart.current) return false;
    const pos = position(event);
    const dx = pos.x - dragStart.current.x;
    const dy = pos.y - dragStart.current.y;
    return Math.hypot(dx, dy) > DRAG_THRESHOLD_PX;
  };

  const addCard = (id) => {
    if (locked || plate.includes(id) || plate.length >= maxItems) return;
    setPlate((previous) => [...previous, id]);
    onActivity?.();
  };
  const removeCard = (id) => {
    if (locked) return;
    setPlate((previous) => previous.filter((cardId) => cardId !== id));
    onActivity?.();
  };

  const trayCards = cards.filter((card) => !plate.includes(card.id));
  const plateCards = plate.map((id) => cards.find((card) => card.id === id)).filter(Boolean);

  return (
    <div className="meal-builder-activity">
      <header className="meal-builder-heading">
        <h1>{title}</h1>
        <p>Drag a card onto the plate, or tap a card to add it.</p>
      </header>
      <p className="meal-builder-status" role="status">
        {plateCards.length} of {maxItems} chosen
      </p>
      <div className="meal-builder-board" ref={board}>
        <div className="meal-builder-plate-wrap">
          <div
            className={`meal-builder-plate${overPlate ? ' is-hovered' : ''}`}
            data-plate-drop
          >
            {plateCards.length === 0 && <span className="meal-builder-plate-hint">Your plate</span>}
            {plateCards.map((card) => (
              <button
                key={card.id}
                type="button"
                className="meal-builder-plate-item"
                disabled={locked}
                onClick={() => removeCard(card.id)}
              >
                <span className="meal-builder-emoji">{card.emoji}</span>
                {card.label}
              </button>
            ))}
          </div>
        </div>
        <div className="meal-builder-tray">
          {trayCards.map((card) => (
            <button
              key={card.id}
              type="button"
              className="meal-builder-card"
              disabled={locked || plate.length >= maxItems}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                addCard(card.id);
              }}
              onPointerDown={(event) => {
                if (locked || event.button !== 0) return;
                suppressClick.current = false;
                dragStart.current = position(event);
                setDragId(card.id);
                setPointer(position(event));
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (dragId !== card.id) return;
                setPointer(position(event));
                setOverPlate(isOverPlate(event));
                if (passedDragThreshold(event)) suppressClick.current = true;
              }}
              onPointerUp={(event) => {
                if (dragId !== card.id) return;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                if (passedDragThreshold(event)) suppressClick.current = true;
                const dropped = isOverPlate(event);
                setDragId(null);
                setPointer(null);
                setOverPlate(false);
                dragStart.current = null;
                if (dropped) {
                  addCard(card.id);
                  event.preventDefault();
                }
              }}
              onPointerCancel={() => {
                setDragId(null);
                setPointer(null);
                setOverPlate(false);
                dragStart.current = null;
              }}
            >
              <span className="meal-builder-emoji">{card.emoji}</span>
              {card.label}
            </button>
          ))}
        </div>
        {dragId && pointer && (
          <div className="meal-builder-ghost" style={{ left: pointer.x, top: pointer.y }}>
            {cards.find((card) => card.id === dragId)?.emoji} {cards.find((card) => card.id === dragId)?.label}
          </div>
        )}
      </div>
      <footer className="meal-builder-actions">
        <button type="button" disabled={locked || plateCards.length === 0} onClick={() => { setPlate([]); onActivity?.(); }}>
          Clear
        </button>
        <button
          type="button"
          disabled={locked || submitDisabled || plateCards.length === 0}
          onClick={async () => {
            setSubmitting(true);
            const success = await onComplete(`[[meal-builder:${JSON.stringify({ cardIds: plate })}]]`);
            if (success) {
              setSubmitted(true);
            }
            setSubmitting(false);
          }}
        >
          {submitted ? "Plate submitted" : submitting ? "Submitting…" : "That's my plate"}
        </button>
      </footer>
    </div>
  );
}

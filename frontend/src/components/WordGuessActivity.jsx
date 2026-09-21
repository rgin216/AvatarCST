import { useEffect, useRef, useState } from 'react';
import { isValidWord, scoreGuess, wordHint } from '../utils/wordGuess';
import './WordGamesActivity.css';

const SOLUTION = 'PLANT';
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
const statusLabels = { green: 'right place', yellow: 'different place', grey: 'no unused copy in word' };

export default function WordGuessActivity({ sessionId, disabled, onActivity, onComplete }) {
  const storageKey = `word-game:${sessionId}`;
  const [game, setGame] = useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (Array.isArray(saved?.guesses) && saved.guesses.length <= 6 && saved.guesses.every(g => /^[A-Z]{5}$/.test(g) && isValidWord(g))) return saved;
    } catch { /* Start fresh if storage is unavailable. */ }
    return { guesses: [], hint: false };
  });
  const [draft, setDraft] = useState(Array(5).fill(''));
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState('');
  const inputs = useRef([]);
  const won = game.guesses.includes(SOLUTION);
  const finished = won || game.guesses.length >= 6;
  useEffect(() => {
    if (game.guesses.length > 0 && !finished && !disabled) inputs.current[0]?.focus();
  }, [game.guesses.length, finished, disabled]);
  const hint = wordHint(SOLUTION);
  const keyboardStates = {};
  const ranks = { grey: 1, yellow: 2, green: 3 };
  game.guesses.forEach(word => scoreGuess(word, SOLUTION).forEach((state, i) => {
    if ((ranks[keyboardStates[word[i]]] || 0) < ranks[state]) keyboardStates[word[i]] = state;
  }));
  if (game.hint) {
    keyboardStates[hint.green.letter] = 'green';
    if (keyboardStates[hint.yellow.letter] !== 'green') keyboardStates[hint.yellow.letter] = 'yellow';
  }
  function save(next) {
    setGame(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep in-memory state. */ }
    onActivity?.();
  }
  function focus(index) {
    setSelected(index);
    inputs.current[index]?.focus();
    inputs.current[index]?.select();
  }
  function enterLetters(text, index = selected) {
    if (disabled || finished) return;
    const letters = text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5 - index);
    if (!letters) return;
    setDraft(current => { const next = [...current]; [...letters].forEach((letter, offset) => { next[index + offset] = letter; }); return next; });
    setError('');
    focus(Math.min(4, index + letters.length));
    onActivity?.();
  }
  function erase(index = selected) {
    if (disabled || finished) return;
    const target = draft[index] ? index : Math.max(0, index - 1);
    setDraft(current => current.map((letter, i) => i === target ? '' : letter));
    focus(target);
    setError('');
    onActivity?.();
  }
  function submit() {
    if (disabled || finished) return;
    if (draft.some(letter => !letter)) { setError('Fill all five boxes before checking your guess.'); return; }
    const guess = draft.join('');
    if (game.guesses.includes(guess)) { setError('You have already tried that word. Try a different one.'); return; }
    if (!isValidWord(guess)) { setError('That is not in the word list. Try a real five-letter word.'); return; }
    save({ ...game, guesses: [...game.guesses, guess] });
    setDraft(Array(5).fill(''));
    setSelected(0);
    setError('');
  }
  function keyDown(event, index) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); enterLetters(event.key, index); }
    else if (event.key === 'Backspace') { event.preventDefault(); erase(index); }
    else if (event.key === 'Delete') { event.preventDefault(); setDraft(current => current.map((letter, i) => i === index ? '' : letter)); }
    else if (event.key === 'Enter') { event.preventDefault(); submit(); }
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); focus(Math.max(0, Math.min(4, index + (event.key === 'ArrowLeft' ? -1 : 1)))); }
  }
  function tile(letter, state, i, prefix = 'Letter') {
    return <span key={i} className={`word-tile ${state || 'empty'}`} aria-label={`${prefix} ${i + 1}: ${letter ? `${letter}, ${statusLabels[state]}` : 'empty'}`}>{letter}{letter && <small aria-hidden="true">{state === 'green' ? '✓' : state === 'yellow' ? '↔' : '–'}</small>}</span>;
  }
  return <div className="word-games-activity wordle-activity">
    <header className="wordle-heading"><h1>Five-letter word game</h1><p>Find the word in six guesses. Tap a box, then type or use the keyboard below.</p></header>
    <div className="wordle-layout">
      <section className="wordle-play" aria-label="Word game">
        <div className="word-guess-board" aria-label="Six guesses, five letters each">
          {Array.from({ length: 6 }, (_, row) => {
            const word = game.guesses[row];
            const scores = word ? scoreGuess(word, SOLUTION) : [];
            const active = !finished && row === game.guesses.length;
            return <div className={`word-guess-row${active ? ' is-current' : ''}`} key={row} role="group" aria-label={`Guess ${row + 1}${active ? ', enter your letters' : ''}`}>
              {Array.from({ length: 5 }, (_, i) => active ? <input key={i} ref={el => { inputs.current[i] = el; }} className={`word-tile letter-input${selected === i ? ' is-selected' : ''}`} aria-label={`Guess ${row + 1}, letter ${i + 1}`} value={draft[i]} maxLength={1} autoComplete="off" autoCapitalize="characters" spellCheck={false} disabled={disabled} onFocus={() => setSelected(i)} onClick={event => event.target.select()} onKeyDown={event => keyDown(event, i)} onChange={event => {
                if (!event.target.value) setDraft(current => current.map((letter, n) => n === i ? '' : letter));
                else enterLetters(event.target.value, i);
              }} onPaste={event => { event.preventDefault(); enterLetters(event.clipboardData.getData('text'), i); }} /> : tile(word?.[i], scores[i], i))}
            </div>;
          })}
        </div>
        <p className="wordle-status" role="status">{won ? 'You found it — lovely work!' : finished ? `Thank you for trying. The word was ${SOLUTION}.` : `Guess ${game.guesses.length + 1} of 6. Take your time.`}</p>
        {error && <p className="wordle-error" role="alert">{error}</p>}
        <div className="wordle-keyboard" role="group" aria-label="On-screen keyboard">
          {KEY_ROWS.map((row, index) => <div className="wordle-key-row" key={row}>
            {index === 2 && <button className="wordle-key wordle-key-wide" disabled={disabled || finished} onClick={submit}>Enter</button>}
            {[...row].map(letter => <button key={letter} className={`wordle-key ${keyboardStates[letter] || ''}`} aria-label={`${letter}${keyboardStates[letter] ? `, ${statusLabels[keyboardStates[letter]]}` : ''}`} disabled={disabled || finished} onClick={() => enterLetters(letter)}>{letter}</button>)}
            {index === 2 && <button className="wordle-key wordle-key-wide" aria-label="Delete letter" disabled={disabled || finished} onClick={() => erase()}>⌫</button>}
          </div>)}
        </div>
      </section>
      <aside className="wordle-help" aria-label="Instructions and hints">
        <h2>Follow the colours</h2>
        <p><span className="wordle-swatch green">✓</span> Green: right letter, right box.</p>
        <p><span className="wordle-swatch yellow">↔</span> Yellow: right letter, move it to another box.</p>
        <p><span className="wordle-swatch grey">–</span> Grey: that copy of the letter is not needed.</p>
        <p className="wordle-practice-note">Try an everyday word. Any five letters are welcome in this practice game.</p>
        <button disabled={disabled || finished || game.hint} onClick={() => save({ ...game, hint: true })}>Give me a hint</button>
        {game.hint && <section className="wordle-hint" aria-label="Letter hint">
          <h2>Your hint</h2>
          <div className="word-guess-row" aria-label="Hint positions">
            {Array.from({ length: 5 }, (_, i) => i === hint.green.position - 1 ? tile(hint.green.letter, 'green', i, 'Position') : i === hint.yellow.excludedPosition - 1 ? tile(hint.yellow.letter, 'yellow', i, 'Position') : tile('', '', i, 'Position'))}
          </div>
          <p>{hint.green.letter} belongs in box {hint.green.position}. {hint.yellow.letter} belongs somewhere else, not box {hint.yellow.excludedPosition}.</p>
        </section>}
        <button className="wordle-finish" disabled={disabled} onClick={() => onComplete(won ? 'I found the five-letter word.' : 'I would like to finish the word game.')}>{finished ? 'Continue' : 'Finish this game'}</button>
      </aside>
    </div>
  </div>;
}

import { useEffect, useState } from "react";
import "./TriviaChoiceActivity.css";

// Both rounds' questions and options are shown at once (matching Aria's spoken
// intro, which asks every round's question up front in one line) and can be
// answered in either order - by tapping, or by typing/speaking a guess in the
// normal chat input, exactly like the naming-slots activities. A tap submits
// that single round immediately (`persistedSelections` reflects the server's
// confirmed state once the turn completes, the same way a spoken guess would),
// rather than batching every round into one submission at the end.
export default function TriviaChoiceActivity({
  interaction,
  title,
  persistedSelections,
  disabled,
  submitDisabled,
  onActivity,
  onComplete,
}) {
  const [pendingRound, setPendingRound] = useState(null);
  const [optimistic, setOptimistic] = useState({});
  const rounds = interaction?.rounds || [];
  const confirmed = persistedSelections || {};
  // Optimistic taps disappear once the server confirms them (or reverts if the
  // submission failed), so a stale local guess never contradicts the real state.
  const selectedByRound = { ...optimistic, ...confirmed };
  const locked = disabled || submitDisabled;

  useEffect(() => {
    setOptimistic((previous) => {
      const next = { ...previous };
      let changed = false;
      for (const key of Object.keys(next)) {
        if (confirmed[key] !== undefined) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : previous;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [persistedSelections]);

  const choose = async (roundIndex, optionId) => {
    if (locked || pendingRound !== null || selectedByRound[roundIndex] !== undefined) return;
    onActivity?.();
    setPendingRound(roundIndex);
    setOptimistic((previous) => ({ ...previous, [roundIndex]: optionId }));
    const success = await onComplete(`[[trivia-choice:${JSON.stringify({ roundIndex, optionId })}]]`);
    if (!success) {
      setOptimistic((previous) => {
        const next = { ...previous };
        delete next[roundIndex];
        return next;
      });
    }
    setPendingRound(null);
  };

  return (
    <div className="trivia-choice-activity">
      <div className="trivia-choice-card">
        {title && <h1>{title}</h1>}
        <div className="trivia-choice-rounds">
          {rounds.map((round, roundIndex) => {
            const selectedId = selectedByRound[roundIndex];
            const answered = selectedId !== undefined;
            const isCorrectGuess = answered && selectedId === round.correctOptionId;

            return (
              <div className="trivia-choice-round" key={roundIndex}>
                {round.question && <p className="trivia-choice-question">{round.question}</p>}
                <div className="trivia-choice-options">
                  {(round.options || []).map((option) => {
                    const isSelected = option.id === selectedId;
                    const isCorrectOption = answered && option.id === round.correctOptionId;
                    return (
                      <button
                        type="button"
                        key={option.id}
                        className={
                          "trivia-choice-option" +
                          (isSelected ? " is-selected" : "") +
                          (isCorrectOption ? " is-correct" : "")
                        }
                        disabled={locked || answered || pendingRound !== null}
                        onClick={() => choose(roundIndex, option.id)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {answered && (
                  <p className={"trivia-choice-result" + (isCorrectGuess ? " is-correct" : " is-incorrect")}>
                    <span className="trivia-choice-result-icon" aria-hidden="true">
                      {isCorrectGuess ? "✓" : "✕"}
                    </span>
                    {isCorrectGuess
                      ? "Correct!"
                      : `You guessed ${(round.options || []).find((o) => o.id === selectedId)?.label ?? selectedId}.`}
                  </p>
                )}
                {answered && round.fact && <p className="trivia-choice-fact">{round.fact}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

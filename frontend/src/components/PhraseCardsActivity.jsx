import { Fragment } from 'react';
import './PhraseCardsActivity.css';

// Purely a display surface - unlike MatchingActivity/MealBuilderActivity there is
// no completion event. The participant answers via the normal mic/text turn, same
// as the instrument sound clips; this just replaces the slide image (which would
// otherwise give away the answers) with the blanked-out sayings.
//
// Once a card's slot has been attempted, the backend hands back a reveal string in
// `namingSlots.revealed` (the scripted answer, or - for an open "whatever comes to
// mind" blank - the participant's own word echoed back). We splice it in wherever
// the card text has a run of underscores.
export default function PhraseCardsActivity({ interaction, title, namingSlots }) {
  const { cards = [], icon, instruction = 'See if you can finish each saying — it is fine to guess.' } = interaction;
  const revealed = namingSlots?.revealed || [];

  return (
    <div className="phrase-cards-activity">
      <header className="phrase-cards-heading">
        <h1>{title}</h1>
        <p>{instruction}</p>
      </header>
      <div className="phrase-cards-board" style={icon ? { '--phrase-card-icon': `"${icon}"` } : undefined}>
        {cards.map((card, index) => {
          const answer = revealed[index];
          const parts = answer ? card.text.split(/_+/) : [card.text];
          const blankCount = parts.length - 1;
          // A card can have more than one blank (e.g. "Two ___ in a ___.")
          // with a multi-word answer meant to fill them one word each ("peas
          // and pod"), not the whole answer repeated into every blank. Split
          // on "and"/comma as a joiner, not raw whitespace, or "and" itself
          // would end up filling a blank.
          const answerWords = answer && blankCount > 1
            ? answer.split(/\s+and\s+|\s*,\s*/).filter(Boolean)
            : null;
          const answerForBlank = (blankIndex) =>
            answerWords ? answerWords[blankIndex] || answerWords[answerWords.length - 1] : answer;
          return (
            <div key={card.id} className="phrase-card">
              {parts.map((part, partIndex) => (
                <Fragment key={partIndex}>
                  {part}
                  {answer && partIndex < parts.length - 1 && (
                    <span className="phrase-card-answer">{answerForBlank(partIndex)}</span>
                  )}
                </Fragment>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

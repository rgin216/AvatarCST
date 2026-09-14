import './PhraseCardsActivity.css';

// Purely a display surface - unlike MatchingActivity/MealBuilderActivity there is
// no completion event. The participant answers via the normal mic/text turn, same
// as the instrument sound clips; this just replaces the slide image (which would
// otherwise give away the answers) with the blanked-out sayings.
export default function PhraseCardsActivity({ interaction, title }) {
  const { cards = [] } = interaction;

  return (
    <div className="phrase-cards-activity">
      <header className="phrase-cards-heading">
        <h1>{title}</h1>
        <p>See if you can finish each saying — it is fine to guess.</p>
      </header>
      <div className="phrase-cards-board">
        {cards.map((card) => (
          <div key={card.id} className="phrase-card">
            {card.text}
          </div>
        ))}
      </div>
    </div>
  );
}

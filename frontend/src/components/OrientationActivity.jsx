import { useId, useState } from 'react';
import './OrientationActivity.css';

export default function OrientationActivity({ interaction, title, disabled, onActivity, onComplete }) {
  const [answer, setAnswer] = useState('');
  const inputId = useId();
  const isChoice = interaction.type === 'choiceQuestion';
  return <div className="orientation-activity">
    <p className="orientation-progress">{interaction.progress}</p>
    <h1>{title}</h1>
    <p className="orientation-question" id={`${inputId}-question`}>{interaction.question}</p>
    {isChoice ? <form onSubmit={(event) => { event.preventDefault(); if (answer && !disabled) onComplete(answer); }}>
      <label htmlFor={inputId}>Choose a place</label>
      <select id={inputId} aria-describedby={`${inputId}-question`} value={answer} disabled={disabled}
        onChange={(event) => { setAnswer(event.target.value); onActivity?.(); }}>
        <option value="">Select an answer…</option>
        {interaction.options.map((option, index) => <option key={option} value={option}>{'ABCD'[index]}. {option}</option>)}
      </select>
      <p>You can also say or type the letter or place name.</p>
      <div className="orientation-actions">
        <button type="submit" disabled={disabled || !answer}>Confirm answer</button>
        <button type="button" disabled={disabled} onClick={() => onComplete('I am not sure')}>I’m not sure</button>
      </div>
    </form> : <>
      <p>Take your time. Say or type whatever comes to mind.</p>
      <div className="orientation-actions"><button type="button" disabled={disabled} onClick={() => onComplete('I would like to pass')}>Pass this question</button></div>
    </>}
  </div>;
}

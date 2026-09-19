import { useId } from 'react';

export default function SessionInputBar({ value, onChange, onSend, onMicClick, isRecording = false, disabled = false, micDisabled = disabled, textDisabled = disabled, micTitle, micPending = false, spotlight, inputDescription }) {
  const id = useId();
  return <footer className="session-input-bar">
    <button type="button" onClick={onMicClick}
      className={`mic-btn${isRecording ? ' mic-btn-active' : ''}${spotlight === 'microphone' ? ' tutorial-spotlight' : ''}`}
      aria-label={micPending ? 'Waiting for microphone permission' : isRecording ? 'Stop recording' : 'Start microphone'}
      disabled={micDisabled} title={micTitle} aria-describedby={spotlight === 'microphone' ? inputDescription : undefined}>
      {isRecording ? <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
        : <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none"/></svg>}
    </button>
    <div className={`session-text-controls${spotlight === 'text' ? ' tutorial-spotlight' : ''}`}>
      <input id={id} aria-label="Your response" value={value} onChange={event => onChange(event.target.value)}
        onKeyDown={event => { if (event.key === 'Enter' && !event.nativeEvent.isComposing) { event.preventDefault(); onSend(value); } }}
        placeholder="Type your response..." className="chat-input" disabled={textDisabled}
        aria-describedby={spotlight === 'text' ? inputDescription : undefined}/>
      <button type="button" onClick={() => onSend(value)} className="send-btn" aria-label="Send" disabled={textDisabled}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      </button>
    </div>
  </footer>;
}

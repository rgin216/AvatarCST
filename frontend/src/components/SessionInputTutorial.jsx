import { useEffect, useRef, useState } from 'react';
import SessionInputBar from './SessionInputBar.jsx';
import { createPracticeRecorder } from '../utils/practiceRecorder.js';
import './SessionInputTutorial.css';

export default function SessionInputTutorial({ onComplete, sessionTitle = 'Your session' }) {
  const [step, setStep] = useState('text');
  const [input, setInput] = useState('');
  const [sent, setSent] = useState('');
  const [recording, setRecording] = useState({status:'idle'});
  const root = useRef(null);
  const heading = useRef(null);
  const recorder = useRef(null);
  const audio = useRef(null);
  useEffect(() => {
    const practice = createPracticeRecorder({onChange:setRecording});
    recorder.current = practice;
    return () => practice.dispose();
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  useEffect(() => {
    const footer = root.current.querySelector('.session-input-bar');
    const measure = () => root.current?.style.setProperty('--practice-footer-height', `${footer.getBoundingClientRect().height}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);
  const finish = () => { audio.current?.pause(); recorder.current?.dispose(); onComplete(); };
  const changeStep = (next) => { audio.current?.pause(); recorder.current?.cancel(); setInput(''); setStep(next); };
  const send = (value) => { if (step === 'text' && value.trim()) { setSent(value.trim()); setInput(''); } };
  const busy = ['requesting','processing'].includes(recording.status);
  const isRecording = recording.status === 'recording';
  const message = recording.status === 'requesting' ? 'Your browser may ask for microphone access. Choose Allow to try it.'
    : isRecording ? 'Recording now. Say a few words, then press the square Stop button. It will also stop after 20 seconds.'
    : recording.status === 'processing' ? 'Preparing your practice recording…'
    : recording.status === 'recorded' ? 'Your recording is ready. Play it back below to check whether you can hear yourself.'
    : recording.status === 'error' ? recording.message : '';
  const trapFocus = event => {
    if (event.key === 'Escape') { event.preventDefault(); finish(); return; }
    if (event.key !== 'Tab') return;
    const controls = [...root.current.querySelectorAll('button:not(:disabled), input:not(:disabled), audio[controls], [tabindex="0"]')].filter(node=>node.getClientRects().length);
    const first=controls[0], last=controls.at(-1);
    if (event.shiftKey && (document.activeElement===first || document.activeElement===heading.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement===last) { event.preventDefault(); first?.focus(); }
  };
  return <div ref={root} className={`session-stage input-tutorial tutorial-step-${step}`} role="dialog" aria-modal="true" aria-labelledby="practice-title" onKeyDown={trapFocus}>
    <header className="session-topbar" inert aria-hidden="true"><div className="session-status">Getting ready</div><span>{sessionTitle}</span></header>
    <main className="session-slide-shell" inert aria-hidden="true">
      <section className="ppt-slide tutorial-preview"><span>Welcome</span><h1>{sessionTitle}</h1><p>We will begin when you are ready.</p></section>
      <aside className="session-side-panel"><div className="session-focus-panel"><span>Your conversation</span><strong>Aria will speak here</strong></div><div className="session-bubble avatar">You can speak or type. Take your time.</div></aside>
      <section className="avatar-dock tutorial-avatar"><span aria-hidden="true">A</span><p>Aria</p></section>
    </main>
    <SessionInputBar value={input} onChange={setInput} onSend={send}
      onMicClick={()=>isRecording ? recorder.current?.stop() : recorder.current?.start()}
      isRecording={isRecording} micPending={recording.status==='requesting'}
      micDisabled={step!=='microphone' || busy} textDisabled={step!=='text'}
      spotlight={step} inputDescription="practice-instruction"/>
    <div className="tutorial-dimmer" aria-hidden="true"/>
    <section className="tutorial-coach">
      <div className="tutorial-coach-top"><span>Quick practice · {step==='text' ? '1' : '2'} of 2</span><button type="button" onClick={finish}>Skip practice</button></div>
      <h2 ref={heading} tabIndex={-1} id="practice-title">{step==='text' ? 'Try typing a reply' : 'Try speaking a reply'}</h2>
      <p id="practice-instruction">{step==='text'
        ? 'Tap the highlighted box below. Type “Hello”, or any words you like, then press the Send arrow or Enter.'
        : 'Press the highlighted microphone below. Say “Hello, Aria”, then press it again to stop.'}</p>
      {step==='text' && <div role="status" className={sent ? 'tutorial-feedback' : ''}>{sent && <>You sent: <strong>{sent}</strong><br/>That is how you can reply by typing.</>}</div>}
      {step==='microphone' && <>
        <p role="status" className={message ? 'tutorial-feedback' : ''}>{message}</p>
        {recording.url && <audio ref={audio} controls src={recording.url} aria-label="Play your practice recording" onError={()=>setRecording({status:'error',message:'The recording could not play. Try recording again, or use typing instead.'})}/>}
        {recording.status==='recorded' && <button type="button" className="tutorial-retry" onClick={()=>{audio.current?.pause(); recorder.current?.start();}}>Record again</button>}
      </>}
      <p className="tutorial-note">This is just practice. {step==='microphone' ? 'Your recording stays on this device and is discarded when you leave practice.' : 'Your practice reply will not be saved in the session.'}</p>
      <div className="tutorial-actions">
        {step==='text' ? <>
          <button type="button" className="tutorial-primary" disabled={!sent} onClick={()=>changeStep('microphone')}>Next: microphone</button>
          <button type="button" onClick={()=>changeStep('microphone')}>Try microphone instead</button>
        </> : <>
          <button type="button" className="tutorial-primary" onClick={finish}>{recording.status==='recorded' ? 'Start session' : 'Use typing and start session'}</button>
          <button type="button" onClick={()=>changeStep('text')}>Back to typing</button>
        </>}
      </div>
    </section>
  </div>;
}

// Local practice only: this recorder has no network or session dependency.
export function createPracticeRecorder({ onChange, mediaDevices = globalThis.navigator?.mediaDevices,
  Recorder = globalThis.MediaRecorder, urls = globalThis.URL,
  setTimer = globalThis.setTimeout, clearTimer = globalThis.clearTimeout }) {
  let generation = 0;
  let stream;
  let recorder;
  let timer;
  let playbackUrl;
  let disposed = false;
  let status = 'idle';
  const update = (state) => { status = state.status; if (!disposed) onChange(state); };
  const releaseStream = () => { stream?.getTracks().forEach(track => track.stop()); stream = undefined; };
  const clearRecording = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      if (recorder.state !== 'inactive') recorder.stop();
      recorder = undefined;
    }
    releaseStream();
    if (playbackUrl) urls.revokeObjectURL(playbackUrl);
    playbackUrl = undefined;
  };
  const cancel = () => { generation += 1; clearRecording(); update({status:'idle'}); };
  const stop = () => { if (recorder?.state === 'recording') { update({status:'processing'}); recorder.stop(); } };
  const start = async () => {
    if (disposed || ['requesting','recording','processing'].includes(status)) return;
    cancel();
    const request = generation;
    if (!mediaDevices?.getUserMedia || !Recorder) {
      update({status:'error', message:'Microphone recording is not available in this browser. You can use typing instead.'});
      return;
    }
    update({status:'requesting'});
    try {
      const requestedStream = await mediaDevices.getUserMedia({audio:true});
      if (disposed || request !== generation) { requestedStream.getTracks().forEach(track=>track.stop()); return; }
      stream = requestedStream;
      const mimeType = ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(type=>Recorder.isTypeSupported?.(type));
      recorder = new Recorder(stream, mimeType ? {mimeType} : undefined);
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        if (request !== generation || disposed) return;
        generation += 1;
        clearRecording();
        update({status:'error',message:'The recording could not finish. Try again, or use typing instead.'});
      };
      recorder.onstop = () => {
        if (request !== generation || disposed) return;
        clearTimer(timer);
        timer = undefined;
        const type = recorder.mimeType || mimeType || chunks[0]?.type || '';
        releaseStream();
        const blob = new Blob(chunks,{type});
        if (!blob.size) { update({status:'error',message:'No recording was captured. Please try again, or use typing instead.'}); return; }
        playbackUrl = urls.createObjectURL(blob);
        update({status:'recorded',url:playbackUrl});
      };
      recorder.start(100);
      update({status:'recording'});
      timer = setTimer(stop, 20000);
    } catch (error) {
      if (request !== generation || disposed) return;
      clearRecording();
      update({status:'error', message: error.name === 'NotAllowedError'
        ? 'Microphone access was not allowed. You can allow it in your browser and try again, or use typing instead.'
        : 'We could not open your microphone. Check that it is connected, then try again or use typing instead.'});
    }
  };
  return {start,stop,cancel,dispose:()=>{disposed=true; generation+=1; clearRecording();}};
}

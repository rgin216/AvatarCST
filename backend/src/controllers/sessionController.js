import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import {
  createRealtimeSessionForTurn,
  respondToSessionTurn,
} from '../services/sessionOrchestratorService.js';
import { mintRealtimeTranscriptionClientSecret } from '../services/realtimeService.js';
import { transcribeAudio } from '../services/sttService.js';
import { pipeSpeechStream, synthesizeSpeech } from '../services/ttsService.js';
import { generateLipSync } from '../services/rhubarbService.js';
import { buildAvatarResponse } from '../services/avatarService.js';
import { createSpeechStreamToken, getSpeechStream } from '../services/speechStreamService.js';
import { GENERATED_AUDIO_DIR } from '../config/storage.js';
import {
  getSessionPipelineMode,
  isOpenAIAudioPipeline,
  isOpenAIFastScriptedPipeline,
  isOpenAIScriptedEnergyPipeline,
  DEFAULT_PIPELINE_MODE,
  SESSION_PIPELINE_MODES,
  usesOpenAITextPipeline,
} from '../config/pipeline.js';

const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);

async function timeAsync(label, fn, timings) {
  const start = nowMs();
  try {
    return await fn();
  } finally {
    timings[label] = nowMs() - start;
  }
}

export const createSession = async (req, res, next) => {
  try {
    const session = await Session.create({
      ...req.body,
      pipelineMode: getSessionPipelineMode(req.body?.pipelineMode),
      status: 'active',
      startedAt: new Date(),
    });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
};

export const getUserSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

export const updateSession = async (req, res, next) => {
  try {
    const session = await Session.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
};

export const endSession = async (req, res, next) => {
  try {
    const session = await Session.findByIdAndUpdate(
      req.params.id,
      { status: 'completed', endedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    next(err);
  }
};

export const addMessage = async (req, res, next) => {
  try {
    const message = await Message.create({ sessionId: req.params.id, ...req.body });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ sessionId: req.params.id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

const getTranscriptionProviderForPipeline = (mode) =>
  usesOpenAITextPipeline(mode) ? 'openai' : undefined;

const getSpeechProviderForPipeline = (mode) => {
  if (isOpenAIAudioPipeline(mode)) return 'openai-audio';
  if (usesOpenAITextPipeline(mode)) return 'openai';
  return undefined;
};

const usesAudioEnergyLipsync = (mode) =>
  isOpenAIScriptedEnergyPipeline(mode) || isOpenAIFastScriptedPipeline(mode);

const usesStreamingSpeech = (mode) => isOpenAIFastScriptedPipeline(mode);

async function generateAudioForTurn(assistantText, options = {}, timings = {}) {
  const audioFileName = `${uuidv4()}.${options.provider === 'openai-audio' ? 'wav' : 'mp3'}`;
  const audioOutputPath = path.join(GENERATED_AUDIO_DIR, audioFileName);
  await timeAsync('ttsMs', () => synthesizeSpeech(assistantText, audioOutputPath, options), timings);
  const rhubarbJson = options.lipsync === 'audio-energy'
    ? null
    : await timeAsync('rhubarbMs', () => generateLipSync(audioOutputPath), timings);
  return { audioUrl: `/generated-audio/${audioFileName}`, rhubarbJson, audioOutputPath };
}

function createStreamedAudioForTurn(assistantText, options = {}) {
  const token = createSpeechStreamToken({
    text: assistantText,
    provider: options.provider || 'openai',
    lipsync: 'audio-energy',
  });

  return {
    audioUrl: `/api/sessions/speech-stream/${token}`,
    rhubarbJson: null,
    audioOutputPath: null,
    streaming: true,
  };
}

async function createAudioForTurn(assistantText, pipelineMode, timings) {
  const provider = getSpeechProviderForPipeline(pipelineMode);
  if (usesStreamingSpeech(pipelineMode)) {
    return createStreamedAudioForTurn(assistantText, { provider });
  }

  return generateAudioForTurn(
    assistantText,
    {
      provider,
      lipsync: usesAudioEnergyLipsync(pipelineMode) ? 'audio-energy' : 'rhubarb',
    },
    timings
  );
}

export const respondToSession = async (req, res, next) => {
  let audioOutputPath = null;
  const timings = {};
  const startedAtMs = nowMs();
  try {
    const turn = await timeAsync(
      'orchestratorMs',
      () => respondToSessionTurn({
        sessionId: req.params.id,
        content: req.body?.content,
      }),
      timings
    );

    try {
      const audio = await createAudioForTurn(turn.assistantText, turn.pipelineMode, timings);
      audioOutputPath = audio.audioOutputPath;
      turn.avatar = buildAvatarResponse({
        text: turn.assistantText,
        audioUrl: audio.audioUrl,
        rhubarbJson: audio.rhubarbJson,
        lipsyncEngine: usesAudioEnergyLipsync(turn.pipelineMode) ? 'audio-energy' : 'rhubarb',
      });
      if (audio.streaming) turn.avatar.audio.streaming = true;
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

    turn.timings = { ...timings, totalMs: nowMs() - startedAtMs };
    res.status(201).json(turn);
  } catch (err) {
    if (audioOutputPath) fs.unlink(audioOutputPath, () => {});
    next(err);
  }
};

export const createRealtimeSession = async (req, res, next) => {
  try {
    const session = await createRealtimeSessionForTurn(req.params.id);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

export const getPipelineInfo = (_req, res) => {
  const info = {
    mode: DEFAULT_PIPELINE_MODE,
    ...(DEFAULT_PIPELINE_MODE === 'free' && { stt: 'groq-whisper', llm: 'groq', tts: 'edge-tts', lipsync: 'rhubarb' }),
    ...(DEFAULT_PIPELINE_MODE === 'openai-scripted' && {
      stt: 'openai-transcribe',
      llm: 'openai-responses',
      tts: 'openai-tts',
      lipsync: 'rhubarb',
    }),
    ...(DEFAULT_PIPELINE_MODE === 'openai-scripted-energy' && {
      stt: 'openai-transcribe',
      llm: 'openai-responses',
      tts: 'openai-tts',
      lipsync: 'audio-energy',
    }),
    ...(DEFAULT_PIPELINE_MODE === 'openai-fast-scripted' && {
      stt: 'openai-transcribe',
      llm: 'deterministic-script',
      tts: 'openai-tts-stream',
      lipsync: 'audio-energy',
    }),
    ...(DEFAULT_PIPELINE_MODE === 'openai-audio' && {
      stt: 'openai-transcribe',
      llm: 'openai-responses',
      tts: 'openai-audio-model',
      lipsync: 'rhubarb',
    }),
    availableModes: SESSION_PIPELINE_MODES,
  };
  res.json(info);
};

export const createRealtimeTranscriptionSession = async (_req, res, next) => {
  try {
    const clientSecret = await mintRealtimeTranscriptionClientSecret();
    res.status(201).json({
      model: process.env.OPENAI_REALTIME_TRANSCRIBE_MODEL || 'gpt-realtime-whisper',
      delay: process.env.OPENAI_REALTIME_TRANSCRIBE_DELAY || 'low',
      clientSecret,
    });
  } catch (err) {
    next(err);
  }
};

export const respondAudioToSession = async (req, res, next) => {
  const uploadedFilePath = req.file?.path;
  let audioOutputPath = null;
  const timings = {};
  const startedAtMs = nowMs();

  try {
    const session = await Session.findById(req.params.id).select('pipelineMode').lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const transcriptionProvider = getTranscriptionProviderForPipeline(session.pipelineMode);

    let transcript = '';
    if (uploadedFilePath) {
      transcript = await timeAsync(
        'sttMs',
        () => transcribeAudio(uploadedFilePath, req.file?.originalname, { provider: transcriptionProvider }),
        timings
      );
    }

    const turn = await timeAsync(
      'orchestratorMs',
      () => respondToSessionTurn({ sessionId: req.params.id, content: transcript }),
      timings
    );

    try {
      const audio = await createAudioForTurn(turn.assistantText, session.pipelineMode, timings);
      audioOutputPath = audio.audioOutputPath;
      turn.avatar = buildAvatarResponse({
        text: turn.assistantText,
        audioUrl: audio.audioUrl,
        rhubarbJson: audio.rhubarbJson,
        lipsyncEngine: usesAudioEnergyLipsync(session.pipelineMode) ? 'audio-energy' : 'rhubarb',
      });
      if (audio.streaming) turn.avatar.audio.streaming = true;
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

    turn.transcript = transcript;
    turn.timings = { ...timings, totalMs: nowMs() - startedAtMs };
    res.status(201).json(turn);
  } catch (err) {
    if (audioOutputPath) fs.unlink(audioOutputPath, () => {});
    next(err);
  } finally {
    if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
  }
};

export const streamSpeechToken = async (req, res, next) => {
  try {
    const speech = getSpeechStream(req.params.token);
    if (!speech) return res.status(404).json({ error: 'Speech stream expired or not found' });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    await pipeSpeechStream(speech.text, res, {
      provider: speech.provider,
      responseFormat: 'mp3',
    });
  } catch (err) {
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
    next(err);
  }
};

export const clearUserSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.params.userId });
    const ids = sessions.map(s => s._id);
    await Message.deleteMany({ sessionId: { $in: ids } });
    await Session.deleteMany({ userId: req.params.userId });
    res.json({ deleted: sessions.length });
  } catch (err) {
    next(err);
  }
};

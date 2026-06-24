import fs from 'fs';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import { respondToSessionTurn } from '../services/sessionOrchestratorService.js';
import { transcribeAudio } from '../services/sttService.js';
import { pipeSpeechStream } from '../services/ttsService.js';
import { buildAvatarResponse } from '../services/avatarService.js';
import { createSpeechStreamToken, getSpeechStream } from '../services/speechStreamService.js';
import {
  getSessionPipelineMode,
  isOpenAIFastScriptedPipeline,
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
  if (usesOpenAITextPipeline(mode)) return 'openai';
  return 'edge';
};

function createAudioForTurn(assistantText, pipelineMode) {
  const token = createSpeechStreamToken({
    text: assistantText,
    provider: getSpeechProviderForPipeline(pipelineMode),
    lipsync: 'audio-energy',
  });

  return {
    audioUrl: `/api/sessions/speech-stream/${token}`,
    streaming: true,
  };
}

export const respondToSession = async (req, res, next) => {
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
      const audio = createAudioForTurn(turn.assistantText, turn.pipelineMode);
      turn.avatar = buildAvatarResponse({
        text: turn.assistantText,
        audioUrl: audio.audioUrl,
        lipsyncEngine: 'audio-energy',
      });
      if (audio.streaming) turn.avatar.audio.streaming = true;
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

    turn.timings = { ...timings, totalMs: nowMs() - startedAtMs };
    res.status(201).json(turn);
  } catch (err) {
    next(err);
  }
};

export const getPipelineInfo = (_req, res) => {
  const info = {
    mode: DEFAULT_PIPELINE_MODE,
    ...(DEFAULT_PIPELINE_MODE === 'free' && {
      stt: 'groq-whisper',
      llm: 'groq',
      tts: 'edge-tts-stream',
      lipsync: 'audio-energy',
    }),
    ...(DEFAULT_PIPELINE_MODE === 'openai-fast-scripted' && {
      stt: 'openai-transcribe',
      llm: 'openai-responses',
      tts: 'openai-tts-stream',
      lipsync: 'audio-energy',
    }),
    availableModes: SESSION_PIPELINE_MODES,
  };
  res.json(info);
};

export const respondAudioToSession = async (req, res, next) => {
  const uploadedFilePath = req.file?.path;
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
      const audio = createAudioForTurn(turn.assistantText, session.pipelineMode);
      turn.avatar = buildAvatarResponse({
        text: turn.assistantText,
        audioUrl: audio.audioUrl,
        lipsyncEngine: 'audio-energy',
      });
      if (audio.streaming) turn.avatar.audio.streaming = true;
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

    turn.transcript = transcript;
    turn.timings = { ...timings, totalMs: nowMs() - startedAtMs };
    res.status(201).json(turn);
  } catch (err) {
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

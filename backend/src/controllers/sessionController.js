import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import {
  getSessionInactivityReminder,
  respondToSessionTurn,
} from '../services/sessionOrchestratorService.js';
import { transcribeAudio } from '../services/sttService.js';
import {
  getVoiceOptionsForAvatar,
  pipeSpeechStream,
  synthesizeSpeech,
} from '../services/ttsService.js';
import { generateLipSync, getRhubarbStatus } from '../services/rhubarbService.js';
import { buildAvatarResponse } from '../services/avatarService.js';
import { getSpeechStream } from '../services/speechStreamService.js';
import { GENERATED_AUDIO_DIR } from '../config/storage.js';
import {
  getSessionPipelineMode,
  isOpenAIFastScriptedPipeline,
  DEFAULT_PIPELINE_MODE,
  SESSION_PIPELINE_MODES,
  usesOpenAITextPipeline,
} from '../config/pipeline.js';
import { generateSummary } from '../services/summaryService.js';
import Summary from '../models/Summary.js';

const nowMs = () => Number(process.hrtime.bigint() / 1_000_000n);
const AVATAR_MODES = new Set(['male', 'female', 'visualizer']);
const LIP_SYNC_MODES = new Set(['rhubarb', 'energy']);

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

    // Fire-and-forget: generate summary in background after responding
    const sessionId = session._id;
    const userId = session.userId;
    const pipelineMode = session.pipelineMode;
    Message.find({ sessionId }).sort({ createdAt: 1 }).then((messages) =>
      generateSummary(messages, pipelineMode).then(({ keyTalkingPoints, emotionalTone, engagementLevel, sessionScore }) =>
        Summary.findOneAndUpdate(
          { sessionId },
          { sessionId, userId, keyTalkingPoints, emotionalTone, engagementLevel, sessionScore },
          { upsert: true, runValidators: true }
        )
      )
    ).catch((err) => console.error('[summary] background generation failed:', err));
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

const getAvatarMode = (value) => (AVATAR_MODES.has(value) ? value : 'male');
const getLipSyncMode = (value) => (LIP_SYNC_MODES.has(value) ? value : 'rhubarb');

const shouldUseRhubarbForAvatar = (avatarMode) => avatarMode === 'male' || avatarMode === 'female';

function getSpeechOptions(pipelineMode, avatarMode) {
  const voices = getVoiceOptionsForAvatar(avatarMode);
  const provider = getSpeechProviderForPipeline(pipelineMode);
  return {
    provider,
    voice: provider === 'openai' ? voices.openAiVoice : voices.edgeVoice,
  };
}

async function createRhubarbAudioForTurn(assistantText, pipelineMode, avatarMode, timings) {
  const speechOptions = getSpeechOptions(pipelineMode, avatarMode);
  // Rhubarb converts this file to WAV internally, so serve the much smaller MP3
  // to the browser to reduce mid-sentence buffering on long narration.
  const responseFormat = 'mp3';
  const audioFileName = `${uuidv4()}.${responseFormat}`;
  const audioOutputPath = path.join(GENERATED_AUDIO_DIR, audioFileName);
  try {
    await timeAsync(
      'ttsMs',
      () => synthesizeSpeech(assistantText, audioOutputPath, { ...speechOptions, responseFormat }),
      timings
    );
    const rhubarbJson = await timeAsync(
      'rhubarbMs',
      () => generateLipSync(audioOutputPath),
      timings
    );

    return {
      audioUrl: `/generated-audio/${audioFileName}`,
      rhubarbJson,
      audioOutputPath,
      streaming: false,
      lipsyncEngine: 'rhubarb',
    };
  } catch (error) {
    await fs.promises.unlink(audioOutputPath).catch(() => {});
    throw error;
  }
}

async function createBufferedAudioForTurn(assistantText, pipelineMode, avatarMode, timings) {
  const speechOptions = getSpeechOptions(pipelineMode, avatarMode);
  const audioFileName = `${uuidv4()}.mp3`;
  const audioOutputPath = path.join(GENERATED_AUDIO_DIR, audioFileName);
  try {
    await timeAsync(
      'ttsMs',
      () => synthesizeSpeech(assistantText, audioOutputPath, {
        ...speechOptions,
        responseFormat: 'mp3',
      }),
      timings
    );
    return {
      audioUrl: `/generated-audio/${audioFileName}`,
      audioOutputPath,
      streaming: false,
      lipsyncEngine: 'audio-energy',
    };
  } catch (error) {
    await fs.promises.unlink(audioOutputPath).catch(() => {});
    throw error;
  }
}

async function createAudioForTurn(assistantText, pipelineMode, avatarMode, lipSyncMode, timings) {
  if (!shouldUseRhubarbForAvatar(avatarMode) || lipSyncMode === 'energy') {
    // Fully buffer narration before responding. This trades a little initial latency
    // for uninterrupted playback on slower or variable connections.
    return createBufferedAudioForTurn(assistantText, pipelineMode, avatarMode, timings);
  }

  return createRhubarbAudioForTurn(assistantText, pipelineMode, avatarMode, timings);
}

async function attachAudioToTurn(turn, pipelineMode, avatarMode, lipSyncMode, timings) {
  const segmentDefinitions = Array.isArray(turn.speechSegments) && turn.speechSegments.length > 0
    ? turn.speechSegments
    : [{ text: turn.assistantText, role: 'script' }];
  const audioSegments = [];

  for (const segment of segmentDefinitions) {
    const audio = await createAudioForTurn(
      segment.text,
      pipelineMode,
      avatarMode,
      lipSyncMode,
      timings
    );
    audioSegments.push({
      text: segment.text,
      role: segment.role,
      advanceSlideAfter: Boolean(segment.advanceSlideAfter),
      url: audio.audioUrl,
      streaming: Boolean(audio.streaming),
      lipsyncEngine: audio.lipsyncEngine,
      rhubarbJson: audio.rhubarbJson || null,
    });
  }

  const firstAudio = audioSegments[0];
  turn.avatar = buildAvatarResponse({
    text: turn.assistantText,
    audioUrl: firstAudio?.url,
    rhubarbJson: firstAudio?.rhubarbJson,
    lipsyncEngine: firstAudio?.lipsyncEngine,
  });
  turn.avatar.audio.segments = audioSegments;
  if (firstAudio?.streaming) turn.avatar.audio.streaming = true;
}

export const respondToSession = async (req, res, next) => {
  const timings = {};
  const startedAtMs = nowMs();
  try {
    const avatarMode = getAvatarMode(req.body?.avatarMode);
    const lipSyncMode = getLipSyncMode(req.body?.lipSyncMode);
    const turn = await timeAsync(
      'orchestratorMs',
      () => respondToSessionTurn({
        sessionId: req.params.id,
        content: req.body?.content,
      }),
      timings
    );

    try {
      await attachAudioToTurn(turn, turn.pipelineMode, avatarMode, lipSyncMode, timings);
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

    turn.timings = { ...timings, totalMs: nowMs() - startedAtMs };
    res.status(201).json(turn);
  } catch (err) {
    next(err);
  }
};

export const remindSession = async (req, res, next) => {
  const timings = {};
  const startedAtMs = nowMs();
  try {
    const avatarMode = getAvatarMode(req.body?.avatarMode);
    const lipSyncMode = getLipSyncMode(req.body?.lipSyncMode);
    const turn = await timeAsync(
      'orchestratorMs',
      () => getSessionInactivityReminder(req.params.id, req.body?.activityRevision),
      timings
    );

    try {
      await attachAudioToTurn(turn, turn.pipelineMode, avatarMode, lipSyncMode, timings);
    } catch (ttsErr) {
      console.error('[tts] Skipping reminder audio:', ttsErr.message);
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
    rhubarb: getRhubarbStatus(),
    ...(DEFAULT_PIPELINE_MODE === 'free' && {
      stt: 'groq-whisper',
      llm: 'groq',
      tts: 'edge-tts',
      lipsync: 'rhubarb-for-avatars/audio-energy-for-visualizer',
    }),
    ...(DEFAULT_PIPELINE_MODE === 'openai-fast-scripted' && {
      stt: 'openai-transcribe',
      llm: 'openai-responses',
      tts: 'openai-tts',
      lipsync: 'rhubarb-for-avatars/audio-energy-for-visualizer',
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
    const avatarMode = getAvatarMode(req.body?.avatarMode);
    const lipSyncMode = getLipSyncMode(req.body?.lipSyncMode);
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
      await attachAudioToTurn(turn, session.pipelineMode, avatarMode, lipSyncMode, timings);
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
      voice: speech.voice,
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

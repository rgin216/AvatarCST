import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Session from '../models/Session.js';
import User from '../models/User.js';
import Message from '../models/Message.js';
import {
  getSessionInactivityReminder,
  respondToSessionTurn,
  endSessionAndQueueEvaluation,
} from '../services/sessionOrchestratorService.js';
import { transcribeWithFallback } from '../services/sttService.js';
import {
  getVoiceOptionsForAvatar,
  pipeSpeechStream,
  synthesizeSpeech,
} from '../services/ttsService.js';
import { generateLipSync, getRhubarbStatus } from '../services/rhubarbService.js';
import { buildAvatarResponse } from '../services/avatarService.js';
import { getSpeechStream } from '../services/speechStreamService.js';
import { getOrCreateSpeech, prefetchSpeech, speechCacheKey } from '../services/speechCacheService.js';
import { GENERATED_AUDIO_DIR } from '../config/storage.js';
import {
  getSessionPipelineMode,
  isOpenAIFastScriptedPipeline,
  DEFAULT_PIPELINE_MODE,
  SESSION_PIPELINE_MODES,
  usesOpenAITextPipeline,
  getTranscriptionProviders,
} from '../config/pipeline.js';
import { generateSummary } from '../services/summaryService.js';
import Summary from '../models/Summary.js';
import { createEvaluationAssignment } from '../evaluation/liveConfig.js';
import { EvaluationTurn, SessionEvaluation } from '../models/Evaluation.js';
import { getSessionAccess, INTRO_SCRIPT_ID } from '../services/sessionAccessService.js';
import { nowMs, timeAsync } from '../services/turnTiming.js';
import { getScriptDeckSlideStepIndex } from '../services/cstScriptService.js';

const AVATAR_MODES = new Set(['male', 'female', 'visualizer']);
const LIP_SYNC_MODES = new Set(['rhubarb', 'energy']);

const publicSession = (session) => {
  const result = session?.toObject ? session.toObject() : { ...session };
  if (result?.interactionState?.currentAffairs?.article) {
    delete result.interactionState.currentAffairs.article.fullContent;
  }
  return result;
};

export const createSession = async (req, res, next) => {
  try {
    const access = await getSessionAccess(req.body?.userId);
    const scriptId = req.body?.scriptId || INTRO_SCRIPT_ID;
    if (access.introductionRequired && scriptId !== INTRO_SCRIPT_ID) {
      return res.status(403).json({ error: 'Complete Session 1 fully to unlock the other sessions.', code: 'INTRODUCTION_REQUIRED' });
    }
    const evaluation = await createEvaluationAssignment(req.body?.userId, req.body?.evaluationSelection);
    const session = await Session.create({
      userId: req.body?.userId, title: req.body?.title, theme: req.body?.theme,
      scriptId, evaluation, unlocksSessions: access.introductionRequired,
      pipelineMode: getSessionPipelineMode(req.body?.pipelineMode),
      status: 'active',
      startedAt: new Date(),
    });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
};

export const getUserSessionAccess = async (req, res, next) => {
  try { res.json(await getSessionAccess(req.params.userId)); }
  catch (error) { next(error); }
};

export const getSession = async (req, res, next) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(publicSession(session));
  } catch (err) {
    next(err);
  }
};

export const getUserSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(sessions.map(publicSession));
  } catch (err) {
    next(err);
  }
};

export const updateSession = async (req, res, next) => {
  try {
    // Assignments and progression are server-owned, including dotted/operator updates.
    const progressionKeys = ['scriptStepIndex', 'scriptStepTurnIndex', 'scriptStepRetryCount'];
    const allowed = ['title', 'theme', 'skipToDeckSlide', ...progressionKeys];
    if (Object.keys(req.body || {}).some(key => !allowed.includes(key))) {
      return res.status(400).json({ error: 'Unsupported session update' });
    }
    if (progressionKeys.some(key => key in (req.body || {})) || 'skipToDeckSlide' in (req.body || {})) {
      const existing = await Session.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ error: 'Session not found' });
      if (existing?.evaluation) return res.status(409).json({ error: 'Skipping slides is disabled during evaluation' });
      if (existing?.unlocksSessions) return res.status(409).json({ error: 'Complete Session 1 without skipping slides to unlock the other sessions.' });
      if ('skipToDeckSlide' in req.body) {
        const deckSlide = req.body.skipToDeckSlide;
        if (!Number.isInteger(deckSlide) || deckSlide < 1 || progressionKeys.some(key => key in req.body)) {
          return res.status(400).json({ error: 'Invalid deck slide number' });
        }
        const stepIndex = getScriptDeckSlideStepIndex(existing.scriptId, deckSlide);
        if (stepIndex < 0) return res.status(400).json({ error: 'Deck slide is not in this session' });
        req.body = { scriptStepIndex: stepIndex, scriptStepTurnIndex: 0, scriptStepRetryCount: 0,
          'interactionState.devSkipPending': true };
      }
    }
    const session = await Session.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(publicSession(session));
  } catch (err) {
    next(err);
  }
};

export const endSession = async (req, res, next) => {
  try {
    const session = await endSessionAndQueueEvaluation(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(publicSession(session));

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
    const session = await Session.findById(req.params.id).lean();
    if (session?.evaluation) return res.status(409).json({ error: 'Evaluation messages must use the session response endpoint' });
    const message = await Message.create({ sessionId: req.params.id, ...req.body });
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
};

// Full transcripts are a development debugging aid; in production caregivers
// see only the session summary.
const transcriptsAvailable = () => process.env.NODE_ENV === 'development';

export const getMessages = async (req, res, next) => {
  try {
    if (!transcriptsAvailable()) {
      return res.status(403).json({ error: 'Session transcripts are only available in development' });
    }
    const messages = await Message.find({ sessionId: req.params.id }).sort({ timestamp: 1 });
    res.json(messages);
  } catch (err) {
    next(err);
  }
};

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
    avatarMode,
    voice: provider === 'openai' ? voices.openAiVoice : voices.edgeVoice,
  };
}

async function createRhubarbAudioForTurn(assistantText, pipelineMode, avatarMode, timings, recognizer) {
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
      () => generateLipSync(audioOutputPath, { recognizer }),
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

const usesRhubarb = (avatarMode, lipSyncMode) =>
  shouldUseRhubarbForAvatar(avatarMode) && lipSyncMode !== 'energy';

async function createAudioForTurn(assistantText, pipelineMode, avatarMode, lipSyncMode, timings, recognizer) {
  if (!usesRhubarb(avatarMode, lipSyncMode)) {
    // Fully buffer narration before responding. This trades a little initial latency
    // for uninterrupted playback on slower or variable connections.
    return createBufferedAudioForTurn(assistantText, pipelineMode, avatarMode, timings);
  }

  return createRhubarbAudioForTurn(assistantText, pipelineMode, avatarMode, timings, recognizer);
}

// Acknowledgements are generated fresh each turn, so they use the faster
// recognizer; scripted narration is usually prefetched and keeps the default.
const getRecognizerForSegment = (role) => (role === 'acknowledgement' ? 'phonetic' : 'pocketSphinx');

function getSpeechCacheArgs(text, pipelineMode, avatarMode, lipSyncMode, recognizer) {
  const { provider, voice } = getSpeechOptions(pipelineMode, avatarMode);
  const withRhubarb = usesRhubarb(avatarMode, lipSyncMode);
  const key = speechCacheKey({
    text, provider, voice, avatarMode, withRhubarb, recognizer: withRhubarb ? recognizer : null,
    model: provider === 'openai' ? process.env.OPENAI_TTS_MODEL || null : null,
  });
  // A missing lip-sync track is retried next time unless Rhubarb is not installed.
  const isComplete = (audio) => !withRhubarb || Boolean(audio.rhubarbJson) || !getRhubarbStatus().available;
  return { key, isComplete };
}

async function getAudioForSegment({ text, role }, pipelineMode, avatarMode, lipSyncMode, timings) {
  const recognizer = getRecognizerForSegment(role);
  const { key, isComplete } = getSpeechCacheArgs(text, pipelineMode, avatarMode, lipSyncMode, recognizer);
  let created = false;
  const audio = await getOrCreateSpeech(key, () => {
    created = true;
    return createAudioForTurn(text, pipelineMode, avatarMode, lipSyncMode, timings, recognizer);
  }, { isComplete });
  if (!created) timings.speechCacheHits = (timings.speechCacheHits || 0) + 1;
  return audio;
}

// Synthesizes likely upcoming narration in the background so the turn that
// speaks it can reuse the result instead of waiting for TTS and lip-sync.
function prefetchSegmentAudio(text, pipelineMode, avatarMode, lipSyncMode) {
  if (typeof text !== 'string' || !text.trim()) return;
  const recognizer = getRecognizerForSegment('script');
  const { key, isComplete } = getSpeechCacheArgs(text, pipelineMode, avatarMode, lipSyncMode, recognizer);
  prefetchSpeech(key, () => createAudioForTurn(text, pipelineMode, avatarMode, lipSyncMode, {}, recognizer), { isComplete });
}

async function attachAudioToTurn(turn, pipelineMode, avatarMode, lipSyncMode, timings) {
  const segmentDefinitions = turn.speechSegments?.length
    ? turn.speechSegments
    : [{ text: turn.assistantText, role: 'script' }];

  // Segments are synthesized in parallel; finished audio stays cached for reuse.
  const audioSegments = await timeAsync('audioMs', () => Promise.all(segmentDefinitions.map(async (segment) => {
    const audio = await getAudioForSegment(segment, pipelineMode, avatarMode, lipSyncMode, timings);
    return {
      text: segment.text,
      role: segment.role,
      advanceSlideAfter: Boolean(segment.advanceSlideAfter),
      url: audio.audioUrl,
      streaming: Boolean(audio.streaming),
      lipsyncEngine: audio.lipsyncEngine,
      rhubarbJson: audio.rhubarbJson || null,
    };
  })), timings);

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

// Started only after this turn's own audio is ready, so it never competes with it.
function prefetchNextTurnAudio(turn, pipelineMode, avatarMode, lipSyncMode) {
  const text = turn.nextScriptLinePrediction;
  delete turn.nextScriptLinePrediction;
  if (turn.sessionCompleteAfterResponse || turn.sessionStatus === 'completed') return;
  prefetchSegmentAudio(text, pipelineMode, avatarMode, lipSyncMode);
}

export const respondToSession = async (req, res, next) => {
  const timings = {};
  const turnId = uuidv4();
  const startedAtMs = nowMs();
  try {
    const avatarMode = getAvatarMode(req.body?.avatarMode);
    const lipSyncMode = getLipSyncMode(req.body?.lipSyncMode);
    const turn = await timeAsync(
      'orchestratorMs',
      () => respondToSessionTurn({
        sessionId: req.params.id,
        content: req.body?.content,
        prefetchSpeech: (text, pipelineMode) => prefetchSegmentAudio(text, pipelineMode, avatarMode, lipSyncMode),
      }),
      timings
    );

    try {
      await attachAudioToTurn(turn, turn.pipelineMode, avatarMode, lipSyncMode, timings);
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
      turn.audioStatus = 'error';
    }
    prefetchNextTurnAudio(turn, turn.pipelineMode, avatarMode, lipSyncMode);

    turn.turnId = turnId;
    turn.audioStatus ||= 'ok';
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
    transcriptsAvailable: transcriptsAvailable(),
  };
  res.json(info);
};

// Opt-in newline-delimited JSON: the transcript is written as soon as speech-to-text
// finishes so the patient sees their words while the reply is still being prepared,
// then the full turn (or an error) follows on the final line.
const TRANSCRIPT_STREAM_CONTENT_TYPE = 'application/x-ndjson; charset=utf-8';

function writeStreamLine(res, value) {
  if (!res.destroyed && !res.writableEnded) res.write(`${JSON.stringify(value)}\n`);
}

function startTranscriptStream(res, transcript) {
  res.status(201);
  res.setHeader('Content-Type', TRANSCRIPT_STREAM_CONTENT_TYPE);
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  writeStreamLine(res, { type: 'transcript', transcript });
}

export const respondAudioToSession = async (req, res, next) => {
  const uploadedFilePath = req.file?.path;
  const timings = {};
  const turnId = uuidv4();
  const startedAtMs = nowMs();
  const streamTranscript = req.query?.stream === 'transcript';

  try {
    const avatarMode = getAvatarMode(req.body?.avatarMode);
    const lipSyncMode = getLipSyncMode(req.body?.lipSyncMode);
    const session = await Session.findById(req.params.id).select('pipelineMode userId').lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });
    const transcriptionProviders = getTranscriptionProviders(session.pipelineMode);
    const user = await User.findById(session.userId).select('settings.language').lean();
    const selectedLanguage = user?.settings?.language || 'en';

    let transcript = '';
    if (uploadedFilePath) {
      transcript = await timeAsync(
        'sttMs',
        () => transcribeWithFallback(uploadedFilePath, req.file?.originalname, {
          ...transcriptionProviders,
          language: selectedLanguage,
        }),
        timings
      );
    }
    if (streamTranscript) startTranscriptStream(res, transcript);

    const turn = await timeAsync(
      'orchestratorMs',
      () => respondToSessionTurn({
        sessionId: req.params.id,
        content: transcript,
        prefetchSpeech: (text) => prefetchSegmentAudio(text, session.pipelineMode, avatarMode, lipSyncMode),
      }),
      timings
    );

    try {
      await attachAudioToTurn(turn, session.pipelineMode, avatarMode, lipSyncMode, timings);
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
      turn.audioStatus = 'error';
    }
    prefetchNextTurnAudio(turn, session.pipelineMode, avatarMode, lipSyncMode);

    turn.turnId = turnId;
    turn.audioStatus ||= 'ok';
    turn.transcript = transcript;
    turn.timings = { ...timings, totalMs: nowMs() - startedAtMs };
    if (!streamTranscript) return res.status(201).json(turn);
    writeStreamLine(res, { type: 'turn', turn });
    res.end();
  } catch (err) {
    if (!res.headersSent) return next(err);
    // The 201 status has already gone out with the transcript, so report in-band.
    console.error(`[${err.status || 500}] POST respond-audio stream — ${err.message}`);
    writeStreamLine(res, { type: 'error', status: err.status || 500, error: err.message || 'Internal server error' });
    res.end();
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
    await EvaluationTurn.deleteMany({ sessionId: { $in: ids } });
    await SessionEvaluation.deleteMany({ sessionId: { $in: ids } });
    await Session.deleteMany({ userId: req.params.userId });
    res.json({ deleted: sessions.length });
  } catch (err) {
    next(err);
  }
};

import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Session from '../models/Session.js';
import Message from '../models/Message.js';
import {
  createRealtimeSessionForTurn,
  respondToSessionTurn,
} from '../services/sessionOrchestratorService.js';
import { transcribeAudio } from '../services/sttService.js';
import { synthesizeSpeech } from '../services/ttsService.js';
import { generateLipSync } from '../services/rhubarbService.js';
import { buildAvatarResponse } from '../services/avatarService.js';
import { GENERATED_AUDIO_DIR } from '../config/storage.js';
import { PIPELINE_MODE } from '../config/pipeline.js';

export const createSession = async (req, res, next) => {
  try {
    const session = await Session.create({ ...req.body, status: 'active', startedAt: new Date() });
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

async function generateAudioForTurn(assistantText) {
  const audioFileName = `${uuidv4()}.mp3`;
  const audioOutputPath = path.join(GENERATED_AUDIO_DIR, audioFileName);
  await synthesizeSpeech(assistantText, audioOutputPath);
  const rhubarbJson = await generateLipSync(audioOutputPath);
  return { audioUrl: `/generated-audio/${audioFileName}`, rhubarbJson, audioOutputPath };
}

export const respondToSession = async (req, res, next) => {
  let audioOutputPath = null;
  try {
    const turn = await respondToSessionTurn({
      sessionId: req.params.id,
      content: req.body?.content,
    });

    try {
      const audio = await generateAudioForTurn(turn.assistantText);
      audioOutputPath = audio.audioOutputPath;
      turn.avatar = buildAvatarResponse({
        text: turn.assistantText,
        audioUrl: audio.audioUrl,
        rhubarbJson: audio.rhubarbJson,
      });
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

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
    mode: PIPELINE_MODE,
    ...(PIPELINE_MODE === 'free' && { stt: 'groq-whisper', llm: 'groq', tts: 'edge-tts', lipsync: 'rhubarb' }),
    ...(PIPELINE_MODE === 'realtime' && { provider: 'openai-realtime-mini', lipsync: 'rhubarb' }),
  };
  res.json(info);
};

export const respondAudioToSession = async (req, res, next) => {
  const uploadedFilePath = req.file?.path;
  let audioOutputPath = null;

  try {
    let transcript = '';
    if (uploadedFilePath) {
      transcript = await transcribeAudio(uploadedFilePath, req.file?.originalname);
    }

    const turn = await respondToSessionTurn({ sessionId: req.params.id, content: transcript });

    try {
      const audio = await generateAudioForTurn(turn.assistantText);
      audioOutputPath = audio.audioOutputPath;
      turn.avatar = buildAvatarResponse({
        text: turn.assistantText,
        audioUrl: audio.audioUrl,
        rhubarbJson: audio.rhubarbJson,
      });
    } catch (ttsErr) {
      console.error('[tts] Skipping audio for this turn:', ttsErr.message);
    }

    turn.transcript = transcript;
    res.status(201).json(turn);
  } catch (err) {
    if (audioOutputPath) fs.unlink(audioOutputPath, () => {});
    next(err);
  } finally {
    if (uploadedFilePath) fs.unlink(uploadedFilePath, () => {});
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

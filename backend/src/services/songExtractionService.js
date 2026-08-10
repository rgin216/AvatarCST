import { generateResponse } from './llmService.js';

const SONG_EXTRACTION_MODEL = process.env.OPENAI_SONG_EXTRACTION_MODEL || 'gpt-4o-mini';
const MIN_EXTRACTION_CONFIDENCE = 0.5;

const SONG_EXTRACTION_FORMAT = {
  type: 'json_schema',
  name: 'song_request',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
      artist: {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      },
      confidence: {
        type: 'number',
      },
    },
    required: ['title', 'artist', 'confidence'],
  },
};

const cleanExtractedText = (value, maxLength) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
};

export const parseSongExtraction = (raw = '') => {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const title = cleanExtractedText(parsed?.title, 120);
  const artist = cleanExtractedText(parsed?.artist, 100);
  const confidence = Number(parsed?.confidence);
  if (!title || !Number.isFinite(confidence) || confidence < MIN_EXTRACTION_CONFIDENCE) {
    return null;
  }

  return {
    title,
    artist,
    confidence: Math.min(confidence, 1),
  };
};

export const formatExtractedSongQuery = (song = {}) => {
  const title = cleanExtractedText(song.title, 120);
  const artist = cleanExtractedText(song.artist, 100);
  if (!title) return '';
  return artist ? `${title} by ${artist}` : title;
};

export const extractSongRequest = async (answer = '') => {
  const raw = await generateResponse(
    [
      {
        role: 'system',
        content: [
          'Extract the song title and artist from the user transcript.',
          'Use only information the user stated or unambiguously referred to in this transcript.',
          'Do not use world knowledge to invent a title or artist.',
          'Treat hesitations and filler words as conversation unless the grammar clearly identifies them as a title.',
          'Set title to null when no song title is identifiable. Artist may be null.',
          'Confidence measures how clearly the transcript identifies the song.',
        ].join(' '),
      },
      { role: 'user', content: String(answer).slice(0, 1000) },
    ],
    {
      provider: 'openai',
      model: SONG_EXTRACTION_MODEL,
      maxTokens: 100,
      textFormat: SONG_EXTRACTION_FORMAT,
    }
  );

  return parseSongExtraction(raw);
};

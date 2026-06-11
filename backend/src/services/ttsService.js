import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import fs from 'fs';
import { pipeline } from 'stream/promises';

// NZ English voices: en-NZ-MitchellNeural (male), en-NZ-MollyNeural (female)
// Any Azure Neural voice works — see https://learn.microsoft.com/azure/ai-services/speech-service/language-support
const TTS_VOICE = process.env.TTS_VOICE ?? 'en-NZ-MitchellNeural';

export async function synthesizeSpeech(text, outputPath) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('synthesizeSpeech: text must be a non-empty string');
  }
  const tts = new MsEdgeTTS();
  await tts.setMetadata(TTS_VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  // toFile() treats its argument as a directory — use toStream() to control the output path directly
  const { audioStream } = tts.toStream(text);
  await pipeline(audioStream, fs.createWriteStream(outputPath));
}

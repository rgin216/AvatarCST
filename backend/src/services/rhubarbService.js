import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath);

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(SERVICE_DIR, '../..');
const VENDORED_RHUBARB_PATH = path.join(
  BACKEND_ROOT,
  'vendor',
  'rhubarb',
  'bin',
  process.platform === 'win32' ? 'rhubarb.exe' : 'rhubarb'
);

function resolveRhubarbPath() {
  if (process.env.RHUBARB_PATH) return process.env.RHUBARB_PATH;
  return VENDORED_RHUBARB_PATH;
}

function canUseRhubarbPath(rhubarbPath) {
  return Boolean(process.env.RHUBARB_PATH) || fs.existsSync(rhubarbPath);
}

// Convert audio file to 16-bit mono WAV at 24kHz, the format Rhubarb requires.
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioFrequency(24000)
      .audioChannels(1)
      .audioCodec('pcm_s16le')
      .format('wav')
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
}

export async function generateLipSync(audioFilePath) {
  const rhubarbPath = resolveRhubarbPath();

  if (!canUseRhubarbPath(rhubarbPath)) {
    console.warn(`[rhubarb] Binary not found at: ${rhubarbPath}`);
    return null;
  }

  let inputPath = audioFilePath;
  let tempWavPath = null;
  const ext = audioFilePath.split('.').pop()?.toLowerCase();

  if (ext !== 'wav' && ext !== 'aiff') {
    tempWavPath = audioFilePath.replace(/\.[^.]+$/, '.rhubarb-input.wav');
    try {
      await convertToWav(audioFilePath, tempWavPath);
      inputPath = tempWavPath;
    } catch (err) {
      console.error('[rhubarb] WAV conversion failed:', err.message);
      return null;
    }
  }

  const jsonOutputPath = audioFilePath.replace(/\.[^.]+$/, '.rhubarb.json');

  return new Promise((resolve) => {
    const args = ['--machineReadable', '-f', 'json', '-o', jsonOutputPath, inputPath];
    const proc = spawn(rhubarbPath, args);

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const unlinkSilent = (p) => fs.unlink(p, (err) => {
      if (err) console.error(`[rhubarb] Failed to delete temp file ${p}:`, err.message);
    });

    proc.on('close', (code) => {
      if (tempWavPath) unlinkSilent(tempWavPath);

      if (code !== 0) {
        console.error('[rhubarb] Exited with code', code, stderr.slice(0, 500));
        resolve(null);
        return;
      }

      try {
        const json = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf-8'));
        unlinkSilent(jsonOutputPath);
        resolve(json);
      } catch (err) {
        console.error('[rhubarb] Failed to parse output:', err.message);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      if (tempWavPath) unlinkSilent(tempWavPath);
      console.error('[rhubarb] Spawn failed:', err.message);
      resolve(null);
    });
  });
}

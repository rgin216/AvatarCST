import { spawn } from 'child_process';
import fs from 'fs';

// Returns Rhubarb JSON ({ metadata, mouthCues }) or null if Rhubarb is unavailable/fails.
// The caller is responsible for using placeholder visemes when null is returned.
export async function generateLipSync(audioFilePath) {
  const rhubarbPath = process.env.RHUBARB_PATH;

  if (!rhubarbPath) return null;
  if (!fs.existsSync(rhubarbPath)) {
    console.warn(`[rhubarb] Binary not found at: ${rhubarbPath}`);
    return null;
  }

  const jsonOutputPath = audioFilePath.replace(/\.[^.]+$/, '.rhubarb.json');

  return new Promise((resolve) => {
    const args = ['--machineReadable', '-f', 'json', '-o', jsonOutputPath, audioFilePath];
    const proc = spawn(rhubarbPath, args);

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error('[rhubarb] Exited with code', code, stderr.slice(0, 500));
        resolve(null);
        return;
      }
      try {
        const json = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf-8'));
        fs.unlink(jsonOutputPath, () => {});
        resolve(json);
      } catch (err) {
        console.error('[rhubarb] Failed to parse output:', err.message);
        resolve(null);
      }
    });

    proc.on('error', (err) => {
      console.error('[rhubarb] Spawn failed:', err.message);
      resolve(null);
    });
  });
}

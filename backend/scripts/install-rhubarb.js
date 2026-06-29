import { spawn } from 'child_process';
import { createHash } from 'crypto';
import fs from 'fs/promises';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const RHUBARB_VERSION = '1.14.0';
const RELEASE_BASE_URL = `https://github.com/DanielSWolf/rhubarb-lip-sync/releases/download/v${RHUBARB_VERSION}`;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(SCRIPT_DIR, '..');
const INSTALL_ROOT = path.join(BACKEND_ROOT, 'vendor', 'rhubarb');
const BIN_DIR = path.join(INSTALL_ROOT, 'bin');
const BIN_PATH = path.join(BIN_DIR, process.platform === 'win32' ? 'rhubarb.exe' : 'rhubarb');
const ZIP_PATH = path.join(INSTALL_ROOT, `rhubarb-${process.pid}.zip`);
const EXTRACT_DIR = path.join(INSTALL_ROOT, `extract-${process.pid}`);
const RESOURCE_DIR = path.join(BIN_DIR, 'res');

const required = process.env.REQUIRE_RHUBARB === '1';
const skip = process.env.RHUBARB_SKIP_INSTALL === '1' || process.env.RHUBARB_SKIP_INSTALL === 'true';

const pinnedAssets = {
  win32: {
    name: `Rhubarb-Lip-Sync-${RHUBARB_VERSION}-Windows.zip`,
    sha256: '62fa416a8d5e382a3828ee4bef358ce520d0b4cabdeaea75a7ac266d098d1fe3',
  },
};

function finishWarning(message, error) {
  console.warn(`[rhubarb-install] ${message}`);
  if (error) console.warn(`[rhubarb-install] ${error.message}`);
  if (required) process.exit(1);
}

function requestBuffer(url, headers = {}, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'AvatarCST-rhubarb-installer',
          Accept: 'application/vnd.github+json',
          ...headers,
        },
      },
      (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          res.resume();
          if (redirectCount >= 5) {
            reject(new Error('Too many redirects while downloading Rhubarb'));
            return;
          }
          resolve(requestBuffer(res.headers.location, headers, redirectCount + 1));
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            body += chunk;
          });
          res.on('end', () => {
            reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
          });
          return;
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      }
    );

    req.on('error', reject);
    req.setTimeout(60_000, () => {
      req.destroy(new Error('Timed out downloading Rhubarb'));
    });
  });
}

function getPinnedAsset() {
  const asset = pinnedAssets[process.platform];
  if (!asset) {
    return null;
  }
  return {
    ...asset,
    downloadUrl: `${RELEASE_BASE_URL}/${asset.name}`,
  };
}

function verifyChecksum(buffer, expectedSha256, assetName) {
  const actualSha256 = createHash('sha256').update(buffer).digest('hex');
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `Checksum mismatch for ${assetName}. Expected ${expectedSha256}, received ${actualSha256}`
    );
  }
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

function quotePowerShellLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function rmQuiet(targetPath) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
  } catch (err) {
    console.warn(`[rhubarb-install] Could not clean ${targetPath}: ${err.message}`);
  }
}

async function cleanOldTempFiles() {
  let entries = [];
  try {
    entries = await fs.readdir(INSTALL_ROOT, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((entry) => entry.name.startsWith('extract-') || /^rhubarb-\d+\.zip$/i.test(entry.name))
      .map((entry) => rmQuiet(path.join(INSTALL_ROOT, entry.name)))
  );
}

async function extractZip() {
  await rmQuiet(EXTRACT_DIR);
  await fs.mkdir(EXTRACT_DIR, { recursive: true });

  if (process.platform === 'win32') {
    const command = [
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
      '[System.IO.Compression.ZipFile]::ExtractToDirectory(',
      quotePowerShellLiteral(ZIP_PATH),
      ',',
      quotePowerShellLiteral(EXTRACT_DIR),
      ')',
    ].join(' ');

    await run('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      command,
    ]);
    return;
  }

  await run('unzip', ['-q', '-o', ZIP_PATH, '-d', EXTRACT_DIR]);
}

async function findBinary(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = await findBinary(fullPath);
      if (found) return found;
      continue;
    }

    const isWindowsBinary = process.platform === 'win32' && entry.name.toLowerCase() === 'rhubarb.exe';
    const isUnixBinary = process.platform !== 'win32' && entry.name === 'rhubarb';
    if (isWindowsBinary || isUnixBinary) return fullPath;
  }
  return null;
}

async function main() {
  if (skip) {
    console.log('[rhubarb-install] Skipping because RHUBARB_SKIP_INSTALL is set.');
    return;
  }

  const asset = getPinnedAsset();
  if (!asset) {
    finishWarning(
      `Automatic Rhubarb install is only configured for Windows. Install Rhubarb manually on ${process.platform} or set RHUBARB_PATH.`
    );
    return;
  }

  try {
    await fs.access(BIN_PATH);
    await fs.access(RESOURCE_DIR);
    console.log(`[rhubarb-install] Rhubarb already installed at ${BIN_PATH}`);
    return;
  } catch {
    // Install below.
  }

  try {
    await fs.mkdir(INSTALL_ROOT, { recursive: true });
    await cleanOldTempFiles();

    console.log(`[rhubarb-install] Downloading ${asset.name}`);
    const zip = await requestBuffer(asset.downloadUrl, { Accept: 'application/octet-stream' });
    verifyChecksum(zip, asset.sha256, asset.name);
    await fs.writeFile(ZIP_PATH, zip);

    await extractZip();
    const extractedBinary = await findBinary(EXTRACT_DIR);
    if (!extractedBinary) throw new Error('Downloaded archive did not contain a rhubarb binary');

    await fs.rm(BIN_DIR, { recursive: true, force: true });
    await fs.cp(path.dirname(extractedBinary), BIN_DIR, { recursive: true });
    if (process.platform !== 'win32') await fs.chmod(BIN_PATH, 0o755);
    await rmQuiet(EXTRACT_DIR);
    await rmQuiet(ZIP_PATH);

    console.log(`[rhubarb-install] Installed Rhubarb at ${BIN_PATH}`);
  } catch (err) {
    await rmQuiet(EXTRACT_DIR);
    await rmQuiet(ZIP_PATH);
    finishWarning('Could not install Rhubarb automatically. Lip sync will fall back unless RHUBARB_PATH points to a valid binary.', err);
  }
}

main();

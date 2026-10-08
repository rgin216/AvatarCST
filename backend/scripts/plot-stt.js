// Report figures for the STT WER evaluation, as SVG plus 2x PNG (rendered with headless Edge or Chrome if found).
// Reads aggregate numbers from analyze-stt.js output and per-recording WER from the "after" run.
// Usage: node scripts/plot-stt.js --analysis analysis-before-vs-after --after <afterRunId>
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 800;
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";
// Reference light palette: categorical slots 1-2 validated all-pairs; chrome and ink tokens.
const C = { surface: '#fcfcfb', primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9',
  axis: '#c3c2b7', s1: '#2a78d6', s2: '#eb6834', context: '#b5b3ab' };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = v => `${(100 * v).toFixed(1)}%`;
const minus = s => String(s).replace(/-(?=\d)/g, '−'); // typographic minus for negative numbers
const text = (x, y, s, { size = 12, fill = C.secondary, anchor = 'start', weight = 400 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(minus(s))}</text>`;
const line = (x1, y1, x2, y2, stroke, width = 1) =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>`;
// Column with a 4px rounded data end, square at the baseline.
const column = (x, top, w, base, fill) => {
  const r = Math.min(4, (base - top) / 2);
  return `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z" fill="${fill}"/>`;
};
const bar = (left, y, len, h, fill) => {
  const r = Math.min(4, len / 2);
  return `<path d="M${left},${y} H${left + len - r} Q${left + len},${y} ${left + len},${y + r} V${y + h - r} Q${left + len},${y + h} ${left + len - r},${y + h} H${left} Z" fill="${fill}"/>`;
};
const svg = (h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}">
<rect width="${W}" height="${h}" fill="${C.surface}"/>
${body}
</svg>`;
const header = (title, subtitle) => text(24, 34, title, { size: 18, fill: C.primary, weight: 600 })
  + subtitle.map((s, i) => text(24, 56 + i * 18, s, { size: 13 })).join('');
const legend = (x, y, items, shape = 'square') => {
  let cx = x;
  return items.map(({ name, color }) => {
    const mark = shape === 'dot' ? `<circle cx="${cx + 6}" cy="${y - 4}" r="5" fill="${color}"/>`
      : `<rect x="${cx}" y="${y - 10}" width="12" height="12" rx="3" fill="${color}"/>`;
    const out = mark + text(cx + 18, y, name, { size: 12, fill: C.secondary });
    cx += 18 + name.length * 6.6 + 24;
    return out;
  }).join('');
};
const yAxis = (plot, max, step, format = v => `${Math.round(v * 100)}%`) => {
  let out = '';
  for (let v = 0; v <= max + 1e-9; v += step) {
    const y = plot.y(v);
    out += line(plot.left, y, plot.right, y, v === 0 ? C.axis : C.grid) + text(plot.left - 8, y + 4, format(v), { size: 12, fill: C.muted, anchor: 'end' });
  }
  return out;
};

// Grouped columns with 95% CI whiskers and the estimate labelled above each whisker.
function groupedColumns({ title, subtitle, categories, series, max, step, height = 520 }) {
  const top = 74 + subtitle.length * 18 + 34, bottom = height - 64;
  const plot = { left: 72, right: W - 24, y: v => bottom - (v / max) * (bottom - top) };
  const band = (plot.right - plot.left) / categories.length, barW = 24, pitch = 56;
  let body = header(title, subtitle) + legend(plot.left, top - 22, series) + yAxis(plot, max, step);
  categories.forEach((cat, i) => {
    const center = plot.left + band * (i + 0.5);
    cat.split('\n').forEach((part, k) => { body += text(center, bottom + 22 + k * 16, part, { size: k ? 12 : 13, fill: k ? C.muted : C.secondary, anchor: 'middle' }); });
    series.forEach((s, j) => {
      const v = s.values[i];
      const cx = center + (j - (series.length - 1) / 2) * pitch;
      body += column(cx - barW / 2, plot.y(v.estimate), barW, bottom, s.color);
      body += line(cx, plot.y(v.low), cx, plot.y(v.high), C.secondary, 1.5)
        + line(cx - 5, plot.y(v.low), cx + 5, plot.y(v.low), C.secondary, 1.5)
        + line(cx - 5, plot.y(v.high), cx + 5, plot.y(v.high), C.secondary, 1.5);
      body += text(cx, plot.y(v.high) - 8, pct(v.estimate), { size: 12, fill: C.primary, anchor: 'middle', weight: 600 });
    });
  });
  return svg(height, body);
}

async function render(svgPath, pngPath, height) {
  const browsers = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  for (const browser of browsers) {
    try { await access(browser); } catch { continue; }
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
      `--window-size=${W},${height}`, `--screenshot=${pngPath}`, pathToFileURL(svgPath).href], { stdio: 'ignore' });
    return true;
  }
  return false;
}

try {
  const { values } = parseArgs({ options: {
    analysis: { type: 'string', default: 'analysis-before-vs-after' },
    after: { type: 'string' },
    results: { type: 'string', default: resolve(root, 'evaluation/results') },
    out: { type: 'string', default: resolve(root, 'evaluation/figures') },
  } });
  if (!values.after) throw new Error('Pass --after <afterRunId> for the per-recording figures');
  const analysisDir = resolve(values.results, values.analysis);
  const analysis = JSON.parse(await readFile(resolve(analysisDir, 'analysis.json'), 'utf8'));
  const loudness = JSON.parse(await readFile(resolve(analysisDir, 'clip-loudness.json'), 'utf8'));
  const rows = (await readFile(resolve(values.results, values.after, 'rows.jsonl'), 'utf8')).trim().split('\n').map(l => JSON.parse(l));
  const find = (run, provider, group) => analysis.summaries.find(s => s.run === run && s.provider === provider && s.group === group);
  const tier = (provider, name) => analysis.loudness.tiers.find(t => t.run === 'after' && t.provider === provider && t.tier === name);
  const leakShare = find('before', 'groq', 'All').promptLeaks / find('before', 'groq', 'All').scored;
  const cuts = analysis.loudness.tierCutsDb;
  const figures = {};

  figures['stt-wer-prompt-fix'] = { height: 520, svg: groupedColumns({
    title: 'Removing the STT instruction prompt lowered word error rate',
    subtitle: [`Before the fix, Groq returned prompt text in ${Math.round(100 * leakShare)}% of outputs. 531 DementiaBank clips, 50 speakers.`,
      'Bars: word error rate. Whiskers: 95% confidence interval (speaker-level bootstrap).'],
    categories: ['Groq\nwhisper-large-v3-turbo', 'OpenAI\ngpt-4o-mini-transcribe'],
    series: [
      { name: 'Before: English instruction prompt', color: C.s1, values: ['groq', 'openai'].map(p => find('before', p, 'All').wer) },
      { name: 'After: no prompt (current app)', color: C.s2, values: ['groq', 'openai'].map(p => find('after', p, 'All').wer) },
    ],
    max: 0.7, step: 0.1,
  }) };

  figures['stt-wer-by-loudness'] = { height: 520, svg: groupedColumns({
    title: 'Word error rate falls sharply as recordings get louder',
    subtitle: ['Clips split into thirds by mean loudness of the original tape audio. Current app settings (no prompt).',
      'Bars: word error rate. Whiskers: 95% confidence interval (speaker-level bootstrap).'],
    categories: [`Quietest third\nbelow ${cuts[0].toFixed(1)} dB`, `Middle third\n${cuts[0].toFixed(1)} to ${cuts[1].toFixed(1)} dB`, `Loudest third\n${cuts[1].toFixed(1)} dB and above`],
    series: [
      { name: 'Groq whisper-large-v3-turbo', color: C.s1, values: ['Quietest third', 'Middle third', 'Loudest third'].map(t => tier('groq', t).wer) },
      { name: 'OpenAI gpt-4o-mini-transcribe', color: C.s2, values: ['Quietest third', 'Middle third', 'Loudest third'].map(t => tier('openai', t).wer) },
    ],
    max: 0.7, step: 0.1,
  }) };

  // Per-recording WER (Groq, after) against mean clip loudness, coloured by group.
  const recordings = Object.values(Object.groupBy(rows.filter(r => r.provider === 'groq' && r.status === 'ok'), r => r.transcript)).map(clips => ({
    impaired: clips[0].group !== 'Control',
    db: clips.reduce((s, r) => s + loudness[`${r.transcript}|${r.clip}`], 0) / clips.length,
    wer: clips.reduce((s, r) => s + r.errors, 0) / clips.reduce((s, r) => s + r.referenceWords, 0),
  }));
  const rho = analysis.loudness.correlation.find(c => c.run === 'after' && c.provider === 'groq').spearman;
  {
    const height = 540, top = 128, bottom = height - 64;
    // Pad the domain so edge dots don't sit on the axis.
    const xMin = Math.floor((Math.min(...recordings.map(r => r.db)) - 2) / 5) * 5, xMax = Math.ceil((Math.max(...recordings.map(r => r.db)) + 2) / 5) * 5;
    const plot = { left: 72, right: W - 32, y: v => bottom - v * (bottom - top) };
    const x = db => plot.left + ((db - xMin) / (xMax - xMin)) * (plot.right - plot.left);
    const groups = [{ name: 'Control (no impairment)', color: C.s1, impaired: false }, { name: 'Cognitive impairment', color: C.s2, impaired: true }];
    let body = header('Quieter recordings tend to have higher word error rates', [
      `Each dot is one speaker's recording (Groq, current settings). Spearman correlation ${rho.toFixed(2)}, 50 recordings.`]);
    body += legend(plot.left, top - 22, groups, 'dot') + yAxis(plot, 1, 0.2);
    for (let db = xMin; db <= xMax; db += 5) body += line(x(db), bottom, x(db), bottom + 4, C.axis) + text(x(db), bottom + 20, `${db} dB`, { size: 12, fill: C.muted, anchor: 'middle' });
    body += text((plot.left + plot.right) / 2, bottom + 44, 'Mean clip loudness in the original recording (louder to the right)', { size: 12, fill: C.secondary, anchor: 'middle' });
    for (const g of groups) {
      for (const r of recordings.filter(r => r.impaired === g.impaired)) {
        body += `<circle cx="${x(r.db).toFixed(1)}" cy="${plot.y(r.wer).toFixed(1)}" r="5" fill="${g.color}" stroke="${C.surface}" stroke-width="2"/>`;
      }
    }
    figures['stt-wer-vs-loudness-per-recording'] = { height, svg: svg(height, body) };
  }

  // Per-speaker WER by group, with medians: is dementia speech transcribed worse?
  {
    const height = 520, top = 110, bottom = height - 64;
    const plot = { left: 72, right: W - 24, y: v => bottom - v * (bottom - top) };
    const groups = [{ name: 'Control (no impairment)', color: C.s1, impaired: false }, { name: 'Cognitive impairment', color: C.s2, impaired: true }];
    let body = header('Per-speaker error rates overlap almost completely between groups', [
      'Each dot is one speaker (Groq, current settings); line marks the group median. 25 speakers per group.']) + yAxis(plot, 1, 0.2);
    const band = (plot.right - plot.left) / 2;
    groups.forEach((g, i) => {
      const center = plot.left + band * (i + 0.5);
      const wers = recordings.filter(r => r.impaired === g.impaired).map(r => r.wer).sort((a, b) => a - b);
      const median = (wers[(wers.length - 1) >> 1] + wers[wers.length >> 1]) / 2;
      wers.forEach((w, k) => {
        const jitter = ((k * 37) % 11 - 5) * 9; // deterministic spread so dots don't stack
        body += `<circle cx="${center + jitter}" cy="${plot.y(w).toFixed(1)}" r="5" fill="${g.color}" stroke="${C.surface}" stroke-width="2"/>`;
      });
      body += line(center - 70, plot.y(median), center + 70, plot.y(median), C.primary, 2)
        + text(center + 78, plot.y(median) + 4, `median ${pct(median)}`, { size: 12, fill: C.primary, weight: 600 });
      body += text(center, bottom + 24, `${g.name}`, { size: 13, fill: C.secondary, anchor: 'middle' });
    });
    figures['stt-wer-per-speaker-by-group'] = { height, svg: svg(height, body) };
  }

  // Context against published results on the Pitt corpus (indicative only).
  {
    const items = [
      { label: 'Hu et al. 2023: adapted wav2vec 2.0 + Conformer', wer: 0.1817, app: false },
      { label: 'Akinrintoyo et al. 2025: Whisper fine-tuned', wer: 0.24, app: false },
      { label: 'This app: Groq Whisper, loudest third', wer: tier('groq', 'Loudest third').wer.estimate, app: true },
      { label: 'This app: Groq Whisper, all clips', wer: find('after', 'groq', 'All').wer.estimate, app: true },
    ];
    const rowH = 44, top = 128, height = top + items.length * rowH + 52;
    const left = 320, right = W - 72, max = 0.5;
    const xs = v => left + (v / max) * (right - left);
    let body = header('Off-the-shelf results compared with systems trained on DementiaBank', [
      'Indicative only: published systems use different test splits, clip lengths and text normalisation.']);
    body += legend(24, top - 22, [{ name: 'Published, trained on DementiaBank', color: C.context }, { name: 'This app, no dementia-specific training', color: C.s1 }]);
    for (let v = 0; v <= max + 1e-9; v += 0.1) {
      body += line(xs(v), top, xs(v), top + items.length * rowH, v === 0 ? C.axis : C.grid)
        + text(xs(v), top + items.length * rowH + 20, `${Math.round(v * 100)}%`, { size: 12, fill: C.muted, anchor: 'middle' });
    }
    items.forEach((item, i) => {
      const y = top + i * rowH + (rowH - 24) / 2;
      body += text(left - 12, y + 16, item.label, { size: 13, fill: C.secondary, anchor: 'end' })
        + bar(xs(0), y, xs(item.wer) - xs(0), 24, item.app ? C.s1 : C.context)
        + text(xs(item.wer) + 8, y + 17, pct(item.wer), { size: 12, fill: C.primary, weight: 600 });
    });
    body += text(left, height - 10, 'Word error rate on the DementiaBank Pitt corpus', { size: 12, fill: C.secondary });
    figures['stt-wer-vs-published'] = { height, svg: svg(height, body) };
  }

  await mkdir(values.out, { recursive: true });
  for (const [name, fig] of Object.entries(figures)) {
    const svgPath = resolve(values.out, `${name}.svg`);
    await writeFile(svgPath, fig.svg);
    const rendered = await render(svgPath, resolve(values.out, `${name}.png`), fig.height);
    console.log(`${name}.svg${rendered ? ' + .png' : ' (no Edge/Chrome found for PNG)'}`);
  }
  console.log(`Saved to ${values.out}`);
} catch (error) { console.error(error.message); process.exitCode = 1; }

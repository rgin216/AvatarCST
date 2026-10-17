// Report figures and a summary table for concurrency runs, as SVG plus 2x PNG (headless Edge or Chrome if found).
// Each --run is label=resultsDir; a host-load.csv in that directory (from sample-host-load.ps1) is joined by stage time window.
// Usage: node scripts/plot-concurrency.js --run "Paid (OpenAI)=evaluation/results/RUN_A" --run "Free (Groq + Edge)=evaluation/results/RUN_B"
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { execFileSync } from 'node:child_process';
import { distribution } from '../src/evaluation/latency.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const W = 800;
const FONT = "'Segoe UI', system-ui, -apple-system, sans-serif";
// Same validated light palette as plot-stt.js: categorical slots 1-2, chrome and ink tokens.
const C = { surface: '#fcfcfb', primary: '#0b0b0b', secondary: '#52514e', muted: '#898781', grid: '#e1e0d9',
  axis: '#c3c2b7', series: ['#2a78d6', '#eb6834'] };

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const text = (x, y, s, { size = 12, fill = C.secondary, anchor = 'start', weight = 400 } = {}) =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>`;
const line = (x1, y1, x2, y2, stroke, width = 1, dash = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const column = (x, top, w, base, fill) => {
  const r = Math.min(4, (base - top) / 2);
  if (base - top < 0.5) return line(x, base, x + w, base, fill, 2);
  return `<path d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${base} Z" fill="${fill}"/>`;
};
const svg = (h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" font-family="${FONT}">
<rect width="${W}" height="${h}" fill="${C.surface}"/>
${body}
</svg>`;
const header = (title, subtitle) => text(24, 34, title, { size: 18, fill: C.primary, weight: 600 })
  + subtitle.map((s, i) => text(24, 56 + i * 18, s, { size: 13 })).join('');
const legend = (x, y, items) => {
  let cx = x;
  return items.map(({ name, color, dash }) => {
    const mark = dash === undefined ? `<rect x="${cx}" y="${y - 10}" width="12" height="12" rx="3" fill="${color}"/>`
      : line(cx, y - 4, cx + 22, y - 4, color, 2, dash);
    const width = dash === undefined ? 12 : 22;
    const out = mark + text(cx + width + 6, y, name, { size: 12 });
    cx += width + 6 + name.length * 6.6 + 24;
    return out;
  }).join('');
};
const legendName = (run, levels) => {
  const top = Math.max(...run.stages.map(st => st.concurrency));
  return top < levels.at(-1) ? `${run.label}, run to ${top} users` : run.label;
};
const niceStep = max => [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100].find(s => max / s <= 6) || 200;

function parseCsv(textContent) {
  const [head, ...lines] = textContent.replace(/^\uFEFF/u, '').trim().split(/\r?\n/u);
  const keys = head.split(',');
  return lines.map(l => Object.fromEntries(l.split(',').map((v, i) => [keys[i], i ? Number(v) : v])));
}

// Early sampler files scaled per-process CPU by a nominal 2 s interval, but each sample took longer than that.
// Rescale those by the measured gap between timestamps; files with an elapsedSeconds column are already correct.
function correctHostSamples(samples) {
  if (!samples?.length || 'elapsedSeconds' in samples[0]) return samples;
  return samples.map((s, i) => {
    if (!i) return { ...s, backendCpuPercent: 0, rhubarbCpuPercent: 0 };
    const elapsed = (Date.parse(s.timestamp) - Date.parse(samples[i - 1].timestamp)) / 1000;
    const factor = elapsed > 0 ? 2 / elapsed : 0;
    return { ...s, backendCpuPercent: s.backendCpuPercent * factor, rhubarbCpuPercent: s.rhubarbCpuPercent * factor };
  });
}

async function loadRun(label, dir) {
  const report = JSON.parse(await readFile(resolve(dir, 'report.json'), 'utf8'));
  const host = correctHostSamples(await readFile(resolve(dir, 'host-load.csv'), 'utf8').then(parseCsv).catch(() => null));
  const window = stage => {
    const rows = report.rows.filter(r => r.stage === stage);
    return [Math.min(...rows.map(r => Date.parse(r.startedAt))),
      Math.max(...rows.map(r => Date.parse(r.startedAt) + (r.requestMs || 0) + (r.audioFetchMs || 0)))];
  };
  const within = ([start, end]) => host?.filter(s => { const t = Date.parse(s.timestamp); return t >= start && t <= end; }) || [];
  const mean = values => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
  const p95 = values => { const v = [...values].sort((a, b) => a - b); return v.length ? v[Math.floor(0.95 * (v.length - 1))] : null; };
  // Whole-machine CPU includes short-lived Rhubarb processes that per-process sampling misses between samples.
  const windows = [window('warmup'), ...report.stages.map(s => window(s.concurrency))].filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const idle = host?.filter(s => !windows.some(([a, b]) => { const t = Date.parse(s.timestamp); return t >= a && t <= b; })) || [];
  const stages = report.stages.map(stage => {
    const rows = report.rows.filter(r => r.stage === stage.concurrency);
    const samples = within(window(stage.concurrency));
    const cpu = samples.map(s => s.cpuPercent);
    // The median hides a slow tail when cached narration returns instantly and fresh speech queues, so report the tail share.
    const ok = rows.filter(r => r.kind === 'turn' && r.status === 'ok');
    const slowTurnShare = ok.length ? ok.filter(r => r.requestMs > 8000).length / ok.length : null;
    // Each session has one opening turn, whose long name-bearing narration can't come from the shared speech cache.
    const nonOpeningLatency = distribution(ok.filter(r => r.contentKind !== 'opening').map(r => r.requestMs));
    return { ...stage, slowTurnShare, nonOpeningLatency, host: samples.length ? { samples: samples.length, machineCpuMean: mean(cpu), machineCpuP95: p95(cpu),
      machineCpuMax: Math.max(...cpu), backendCpuMean: mean(samples.map(s => s.backendCpuPercent)),
      backendMemMaxMb: Math.max(...samples.map(s => s.backendMemMb)), rhubarbProcessesMax: Math.max(...samples.map(s => s.rhubarbProcesses)) } : null };
  });
  const idleCpu = idle.map(s => s.cpuPercent);
  return { label, dir, manifest: report.manifest, stages, idleCpu: idleCpu.length ? { samples: idleCpu.length, mean: mean(idleCpu), p95: p95(idleCpu) } : null };
}

// x positions on a log2 scale, so 1, 2, 4, 8, 16 users are evenly spaced.
function xScale(levels, left, right) {
  const lo = Math.log2(Math.min(...levels)), hi = Math.log2(Math.max(...levels));
  return v => (hi === lo ? (left + right) / 2 : left + ((Math.log2(v) - lo) / (hi - lo)) * (right - left));
}
const xAxis = (levels, x, base) => levels.map(v => text(x(v), base + 22, String(v), { size: 12, fill: C.muted, anchor: 'middle' })).join('')
  + text((x(levels[0]) + x(levels.at(-1))) / 2, base + 46, 'Concurrent users (log scale)', { size: 12, anchor: 'middle' });
const yGrid = (left, right, y, max, step, format) => {
  let out = '';
  for (let v = 0; v <= max + 1e-9; v += step) out += line(left, y(v), right, y(v), v === 0 ? C.axis : C.grid) + text(left - 8, y(v) + 4, format(v), { size: 12, fill: C.muted, anchor: 'end' });
  return out;
};

function latencyFigure(runs, levels, scope = 'all') {
  const pick = scope === 'non-opening' ? s => s.nonOpeningLatency : s => s.requestLatency;
  const height = 520, left = 72, right = W - 150, top = 124, base = height - 72;
  const max = Math.max(...runs.flatMap(r => r.stages.map(s => (pick(s).p95Ms || 0) / 1000)));
  const step = niceStep(max), yMax = Math.ceil(max / step) * step;
  const x = xScale(levels, left + 20, right - 20), y = v => base - (v / yMax) * (base - top);
  let body = scope === 'non-opening'
    ? header('Turn latency excluding each session\'s opening turn', ['Same data as the all-turns chart, without the one opening turn per session (long narration with the user\'s name).',
      'Successful turns only. Solid: 95th percentile. Dashed: median.'])
    : header('Turn latency as concurrent users increase', ['Client wait from sending a reply to receiving Aria\'s response, successful turns only.',
      'Solid: 95th percentile. Dashed: median.']);
  body += yGrid(left, right, y, yMax, step, v => `${v} s`) + xAxis(levels, x, base);
  const criterion = runs.map(r => r.manifest.criteria?.p95Ms).find(Number.isFinite);
  if (criterion && criterion / 1000 <= yMax) {
    body += line(left, y(criterion / 1000), right, y(criterion / 1000), C.muted, 1.5, '2 4')
      + text(right - 4, y(criterion / 1000) - 6, `${criterion / 1000} s p95 criterion`, { size: 11, fill: C.muted, anchor: 'end' });
  }
  const ends = [];
  runs.forEach((run, i) => {
    for (const [key, dash, name] of [['p95Ms', '', 'p95'], ['p50Ms', '5 4', 'median']]) {
      const pts = run.stages.filter(s => pick(s)[key] !== null).map(s => [x(s.concurrency), y(pick(s)[key] / 1000)]);
      body += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${C.series[i]}" stroke-width="2" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
      body += pts.map(([px, py]) => `<circle cx="${px}" cy="${py}" r="4" fill="${C.series[i]}" stroke="${C.surface}" stroke-width="2"/>`).join('');
      const last = run.stages.at(-1);
      ends.push({ y: pts.at(-1)[1], x: pts.at(-1)[0], label: `${run.label.split(' ')[0]} ${name} ${(pick(last)[key] / 1000).toFixed(1)} s` });
    }
  });
  // Direct labels at line ends, nudged apart so they never overlap.
  ends.sort((a, b) => a.y - b.y).forEach((e, i, all) => { if (i && e.y - all[i - 1].y < 16) e.y = all[i - 1].y + 16; });
  body += ends.map(e => text(e.x + 10, e.y + 4, e.label, { size: 12, fill: C.primary })).join('');
  body += legend(24, 108, runs.map((r, i) => ({ name: legendName(r, levels), color: C.series[i] })));
  return { height, svg: svg(height, body) };
}

// Two small-multiple panels of grouped columns sharing one percent axis.
function qualityFigure(runs, levels) {
  const height = 520, top = 170, base = height - 72;
  const panels = [['Degraded: LLM failed, scripted text used', s => s.degradedRate], ['No audio returned', s => (s.turnsOk ? s.missingAudio / s.turnsOk : null)]];
  const max = Math.max(0.05, ...runs.flatMap(r => r.stages.flatMap(s => panels.map(([, f]) => f(s) || 0))));
  const step = niceStep(max), yMax = Math.ceil(max / step) * step;
  const y = v => base - (v / yMax) * (base - top);
  let body = header('Turns not delivered as intended, by concurrent users', ['Share of successful HTTP turns. Neither problem shows up as an HTTP error.']);
  const gap = 64, panelW = (W - 56 - gap - 24) / 2;
  panels.forEach(([title, f], p) => {
    const left = 56 + p * (panelW + gap), right = left + panelW;
    body += text(left - 40, top - 22, title, { size: 13, fill: C.primary, weight: 600 });
    body += yGrid(left, right, y, yMax, step, v => `${Math.round(v * 100)}%`);
    const slot = (right - left) / levels.length, colW = Math.min(18, (slot - 12) / runs.length);
    levels.forEach((lv, li) => {
      const cx = left + slot * li + slot / 2;
      body += text(cx, base + 22, String(lv), { size: 12, fill: C.muted, anchor: 'middle' });
      runs.forEach((run, ri) => {
        const stage = run.stages.find(s => s.concurrency === lv);
        if (!stage) return;
        const v = f(stage);
        const x0 = cx - (runs.length * colW + (runs.length - 1) * 2) / 2 + ri * (colW + 2);
        if (v === null) { body += text(x0 + colW / 2, base - 6, 'n/a', { size: 10, fill: C.muted, anchor: 'middle' }); return; }
        body += column(x0, y(v), colW, base, C.series[ri]);
        if (v > 0) body += text(x0 + colW / 2, y(v) - 6, `${Math.round(v * 100)}%`, { size: 10, fill: C.secondary, anchor: 'middle' });
      });
    });
    body += text((left + right) / 2, base + 46, 'Concurrent users', { size: 12, anchor: 'middle' });
  });
  body += legend(24, 108, runs.map((r, i) => ({ name: legendName(r, levels), color: C.series[i] })));
  return { height, svg: svg(height, body) };
}

function cpuFigure(runs, levels) {
  const withHost = runs.filter(r => r.stages.some(s => s.host));
  if (!withHost.length) return null;
  const height = 500, left = 72, right = W - 40, top = 124, base = height - 72;
  const max = Math.max(...withHost.flatMap(r => [r.idleCpu?.p95 || 0, ...r.stages.map(s => s.host?.machineCpuP95 || 0)]));
  const step = niceStep(max), yMax = Math.max(step, Math.ceil(max / step) * step);
  const y = v => base - (v / yMax) * (base - top);
  let body = header('Machine CPU use as concurrent users increase', ['Whole laptop (16 logical cores), with the backend and load generator on the same machine.',
    'Column: mean over the stage. Dot: 95th percentile of samples. Dashed: mean between stages, for comparison.']);
  body += yGrid(left, right, y, yMax, step, v => `${v}%`);
  withHost.forEach((run, i) => {
    if (!run.idleCpu) return;
    const color = C.series[runs.indexOf(run)];
    body += line(left, y(run.idleCpu.mean), right, y(run.idleCpu.mean), color, 1.5, '5 4')
      + text(left + 6, y(run.idleCpu.mean) - 6 - i * 14, `${run.label.split(' ')[0]}: between stages ${run.idleCpu.mean.toFixed(0)}%`, { size: 11 });
  });
  const slot = (right - left) / levels.length, colW = Math.min(28, (slot - 16) / withHost.length);
  levels.forEach((lv, li) => {
    const cx = left + slot * li + slot / 2;
    body += text(cx, base + 22, String(lv), { size: 12, fill: C.muted, anchor: 'middle' });
    withHost.forEach((run, ri) => {
      const h = run.stages.find(s => s.concurrency === lv)?.host;
      if (!h) return;
      const x0 = cx - (withHost.length * colW + (withHost.length - 1) * 2) / 2 + ri * (colW + 2);
      const color = C.series[runs.indexOf(run)];
      body += column(x0, y(h.machineCpuMean), colW, base, color);
      body += text(x0 + colW / 2, y(h.machineCpuMean) + 14, `${h.machineCpuMean.toFixed(0)}%`, { size: 10, fill: C.surface, anchor: 'middle' });
      body += `<circle cx="${x0 + colW / 2}" cy="${y(h.machineCpuP95)}" r="4" fill="${color}" stroke="${C.surface}" stroke-width="2"/>`;
      body += text(x0 + colW / 2, y(h.machineCpuP95) - 9, `${h.machineCpuP95}%`, { size: 10, anchor: 'middle' });
    });
  });
  body += text((left + right) / 2, base + 46, 'Concurrent users', { size: 12, anchor: 'middle' });
  body += legend(24, 108, withHost.map(r => ({ name: legendName(r, levels), color: C.series[runs.indexOf(r)] })));
  return { height, svg: svg(height, body) };
}

async function render(svgPath, pngPath, height) {
  const candidates = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'];
  for (const browser of candidates) {
    if (!(await access(browser).then(() => true, () => false))) continue;
    execFileSync(browser, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=2',
      `--window-size=${W},${height}`, `--screenshot=${pngPath}`, pathToFileURL(svgPath).href], { stdio: 'ignore' });
    return true;
  }
  return false;
}

const f0 = v => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-NZ') : '–');
const p1 = v => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : '–');

try {
  const { values } = parseArgs({ options: { run: { type: 'string', multiple: true }, out: { type: 'string', default: resolve(root, 'evaluation/figures') },
    prefix: { type: 'string', default: 'concurrency' } } });
  if (!values.run?.length || values.run.length > 2) throw new Error('Pass one or two --run "Label=resultsDir" arguments');
  const runs = await Promise.all(values.run.map(spec => { const [label, dir] = spec.split('='); return loadRun(label, resolve(dir)); }));
  const levels = [...new Set(runs.flatMap(r => r.stages.map(s => s.concurrency)))].sort((a, b) => a - b);
  await mkdir(values.out, { recursive: true });
  const figures = { latency: latencyFigure(runs, levels), 'latency-non-opening': latencyFigure(runs, levels, 'non-opening'),
    quality: qualityFigure(runs, levels), cpu: cpuFigure(runs, levels) };
  for (const [name, fig] of Object.entries(figures)) {
    if (!fig) continue;
    const svgPath = resolve(values.out, `${values.prefix}-${name}.svg`);
    await writeFile(svgPath, fig.svg);
    const rendered = await render(svgPath, resolve(values.out, `${values.prefix}-${name}.png`), fig.height);
    console.log(`${values.prefix}-${name}.svg${rendered ? ' + .png' : ' (no Edge/Chrome found for PNG)'}`);
  }
  for (const run of runs) {
    const idle = run.idleCpu ? `, idle machine CPU between stages: mean ${run.idleCpu.mean.toFixed(0)}%, p95 ${run.idleCpu.p95}% (n = ${run.idleCpu.samples})` : '';
    console.log(`\n${run.label} (${run.manifest.runId})${idle}`);
    console.log('| Users | Sessions done / failed / stuck | Turns | Errors | Median | p95 | Max | Turns > 8 s | Degraded | No audio | Turns/min | Peak in flight | Machine CPU mean / p95 / max | Backend process CPU mean | Peak backend memory |');
    console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const s of run.stages) {
      const h = s.host;
      console.log(`| ${s.concurrency} | ${s.completedUsers} / ${s.failedUsers} / ${s.stuckUsers ?? 0} | ${s.turnsAttempted} | ${p1(s.errorRate)} | ${f0(s.requestLatency.p50Ms)} ms | ${f0(s.requestLatency.p95Ms)} ms | ${f0(s.requestLatency.maxMs)} ms | ${p1(s.slowTurnShare)} | ${p1(s.degradedRate)} | ${p1(s.turnsOk ? s.missingAudio / s.turnsOk : null)} | ${s.throughputTurnsPerMin?.toFixed(1)} | ${s.peakInFlight} | ${h ? `${h.machineCpuMean.toFixed(0)}% / ${h.machineCpuP95}% / ${h.machineCpuMax}%` : '–'} | ${h ? `${h.backendCpuMean.toFixed(1)}%` : '–'} | ${h ? `${f0(h.backendMemMaxMb)} MB` : '–'} |`);
    }
  }
  await writeFile(resolve(values.out, `${values.prefix}-summary.json`), JSON.stringify(runs.map(({ label, dir, manifest, stages }) =>
    // Relative to backend/, so the committed summary carries no machine-specific paths.
    ({ label, dir: relative(root, dir).replaceAll('\\', '/'), runId: manifest.runId, pipelineMode: manifest.pipelineMode, stages })), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
